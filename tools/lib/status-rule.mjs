// openrig.status-rule/v1: derives every public tested label from run records. Pure: the loader reads files,
// checks receipts and validates schemas; this module only decides. The rule in words is in tools/README.md.
import { statusBodyDigest } from "./canonical.mjs";

export const RULE_ID = "openrig.status-rule/v1";
export const GENERATOR_VERSION = 1;
export const GENERATED = Object.freeze({
  by: "openrig-world tools/status.mjs",
  notice: "Generated file. Do not edit by hand; regenerate it.",
  rule: RULE_ID,
  generatorVersion: GENERATOR_VERSION,
});

const RANK = { tested: 3, tested_with_help: 2, partly_tested: 1 };

/**
 * @param entries      registry entries (`slug` added by the loader); only `listed` ones get labels
 * @param teamFiles    Map slug -> [{ file, record?, problem?, receiptVerified }]
 * @param harnessFiles [{ file, record?, problem?, receiptVerified }]
 * @param journeys     Map "id@version" -> journey
 * @returns { status, problems } where problems explain every "status_unavailable" (they stay private)
 */
export function deriveStatus({ entries, teamFiles, harnessFiles, journeys }) {
  const problems = [];
  const listings = {};
  for (const entry of entries.filter((e) => e.status === "listed")) {
    const read = readable(teamFiles.get(entry.slug) ?? [], "team", journeys);
    if (read.problem) {
      problems.push(`${entry.slug}: ${read.problem}`);
      listings[entry.slug] = { state: "status_unavailable", configurations: {} };
    } else {
      listings[entry.slug] = { state: "ok", configurations: deriveConfigurations(entry, inForce(read.records)) };
    }
  }
  const harnessRead = readable(harnessFiles, "harness_check", journeys);
  if (harnessRead.problem) problems.push(`harness checks: ${harnessRead.problem}`);
  const harnessChecks = harnessRead.problem
    ? { state: "status_unavailable", harnesses: {} }
    : { state: "ok", harnesses: deriveHarnesses(inForce(harnessRead.records)) };
  const status = { generated: { ...GENERATED }, listings, harnessChecks };
  status.bodyDigest = statusBodyDigest(status);
  return { status, problems };
}

// Step 1, readability, decided before anything else: one record we can't read or interpret makes the
// whole set unavailable, because it might have been a FAIL.
function readable(files, kind, journeys) {
  const records = [];
  const ids = new Set();
  for (const f of files) {
    if (f.problem) return { problem: `${f.file}: ${f.problem}` };
    const r = f.record;
    const journey = journeys.get(`${r.journey.id}@${r.journey.version}`);
    if (!journey) return { problem: `${f.file}: unknown journey ${r.journey.id} v${r.journey.version}` };
    if (journey.kind !== kind) return { problem: `${f.file}: journey ${journey.id} is ${journey.kind}, not ${kind}` };
    if (r.subject.kind !== kind) return { problem: `${f.file}: a ${r.subject.kind} subject on a ${kind} journey` };
    if (ids.has(r.id)) return { problem: `record id ${r.id} appears twice` };
    ids.add(r.id);
    records.push({ ...f, journey });
  }
  return { records };
}

// Step 2, drop: superseded and withdrawn records, and any whose receipt is missing or changed. A relation
// stated by a dropped record still applies, so a lost correction can only remove claims, never restore one.
function inForce(records) {
  const gone = new Set();
  for (const { record } of records) {
    for (const id of record.relations?.supersedes ?? []) gone.add(id);
    for (const id of record.relations?.withdraws ?? []) gone.add(id);
  }
  return records.filter((r) => r.receiptVerified && !gone.has(r.record.id));
}

// Step 3, match: same source folder, configuration and package. A different package counts only through
// the listing's explicit `evidenceReuse`, and then both digests are shown.
function deriveConfigurations(entry, live) {
  const configurations = {};
  for (const cfg of entry.configurations) {
    const current = cfg.packageDigest;
    const accepted = new Set([current.value, ...(cfg.evidenceReuse ?? []).map((reuse) => reuse.packageDigest.value)]);
    const matching = live.filter(({ record: { subject } }) =>
      subject.source.repository === entry.source.repository &&
      subject.source.folder === entry.source.folder &&
      subject.configurationId === cfg.id &&
      accepted.has(subject.packageDigest.value));
    const ours = matching.filter((r) => r.record.evidence.kind !== "community-reported");
    const platforms = {};
    for (const platform of unique(ours.map((r) => r.record.environment.platform))) {
      const label = labelFor(ours.filter((r) => r.record.environment.platform === platform), current);
      if (label) platforms[platform] = label;
    }
    configurations[cfg.id] = { platforms, communityReports: matching.length - ours.length };
  }
  return configurations;
}

// Step 4, label, per platform.
function labelFor(records, current) {
  const failing = records.filter((r) =>
    r.record.outcome.steps.some((s) => s.result === "FAIL" && !isResolved(r, s.id, records)));
  if (failing.length) return labelEntry("known_problem", failing, current);
  let best = null;
  for (const r of records) {
    const level = levelOf(r);
    if (!level) continue;
    if (!best || RANK[level] > RANK[best.level] || (RANK[level] === RANK[best.level] && newer(r, best.r))) best = { level, r };
  }
  return best && labelEntry(best.level, [best.r], current);
}

// A FAIL is resolved only by an applicable, non-withdrawn record that names it in `resolves`, PASSes that
// step, and ran on the same or a newer OpenRig version. `records` is already applicable and in force.
function isResolved(failing, stepId, records) {
  return records.some((q) =>
    q !== failing &&
    (q.record.relations?.resolves ?? []).some((x) => x.record === failing.record.id && x.step === stepId) &&
    stepResult(q, stepId) === "PASS" &&
    compareVersions(q.record.environment.openrig.version, failing.record.environment.openrig.version) >= 0);
}

function levelOf(r) {
  const required = r.journey.requiredSteps.map((s) => s.id);
  if (required.every((id) => stepResult(r, id) === "PASS")) {
    return r.record.outcome.assistance.count > 0 ? "tested_with_help" : "tested";
  }
  return required.some((id) => stepResult(r, id) === "PASS") ? "partly_tested" : null;
}

function labelEntry(label, records, current) {
  const newest = records.reduce((a, b) => (newer(b, a) ? b : a));
  const tested = new Map();
  for (const { record: { subject } } of records) {
    if (subject.packageDigest.value !== current.value) tested.set(subject.packageDigest.value, subject.packageDigest);
  }
  const out = {
    label,
    date: utcDate(newest),
    openrigVersion: newest.record.environment.openrig.version,
    recordIds: unique(records.map((r) => r.record.id)),
    packageDigests: [current, ...[...tested.keys()].sort().map((value) => tested.get(value))],
  };
  if (label === "tested_with_help") out.assistanceCount = newest.record.outcome.assistance.count;
  if (label === "known_problem" && newest.record.outcome.publicNote) out.note = newest.record.outcome.publicNote;
  return out;
}

// Harness checks never make a team label; they're a separate line per harness and platform, from the
// newest record in force.
function deriveHarnesses(live) {
  const harnesses = {};
  for (const harness of unique(live.map((r) => r.record.subject.harness))) {
    harnesses[harness] = {};
    const mine = live.filter((r) => r.record.subject.harness === harness);
    for (const platform of unique(mine.map((r) => r.record.environment.platform))) {
      const newest = mine.filter((r) => r.record.environment.platform === platform).reduce((a, b) => (newer(b, a) ? b : a));
      const line = {
        result: harnessResult(newest),
        date: utcDate(newest),
        openrigVersion: newest.record.environment.openrig.version,
        harnessVersion: newest.record.environment.harnesses.find((h) => h.name === harness)?.version ?? "unknown",
        recordIds: [newest.record.id],
      };
      if (newest.record.outcome.publicNote) line.note = newest.record.outcome.publicNote;
      harnesses[harness][platform] = line;
    }
  }
  return harnesses;
}

function harnessResult(r) {
  const results = r.journey.requiredSteps.map((s) => stepResult(r, s.id));
  if (results.includes("FAIL")) return "FAIL";
  if (results.every((x) => x === "PASS")) return "PASS";
  return results.includes("BLOCKED") ? "BLOCKED" : "NOT_RUN";
}

function stepResult(r, stepId) {
  return r.record.outcome.steps.find((s) => s.id === stepId)?.result ?? "NOT_RUN";
}

function newer(a, b) {
  const at = Date.parse(a.record.outcome.at) - Date.parse(b.record.outcome.at);
  return at !== 0 ? at > 0 : a.record.id > b.record.id;
}

function utcDate(r) {
  return new Date(r.record.outcome.at).toISOString().slice(0, 10);
}

function unique(values) {
  return [...new Set(values)].sort();
}

/** Compares release versions; NaN when either can't be read, so an unreadable version never resolves a FAIL. */
export function compareVersions(a, b) {
  const parse = (v) => /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return Number.NaN;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  if (x[4] === y[4]) return 0;
  if (x[4] === undefined) return 1;
  if (y[4] === undefined) return -1;
  return x[4] < y[4] ? -1 : 1;
}
