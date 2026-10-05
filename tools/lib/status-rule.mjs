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
// Only a real team run earns a team label. Other kinds are read and must be readable, but never label.
const TEAM_LABEL_KINDS = new Set(["native-workflow"]);
// A stub can't show a real harness works, and a community report is never OpenRig's own result.
const HARNESS_LINE_EXCLUDED_KINDS = new Set(["synthetic", "community-reported"]);
// Labels are per environment: Node's platform and architecture, as the status schema spells them.
const PLATFORM = /^(linux|darwin|win32)$/;
const ARCH = /^(x64|arm64)$/;
const environmentOf = (r) => `${r.record.environment.platform}-${r.record.environment.arch}`;

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
    const derived = deriveListing(entry, teamFiles.get(entry.slug) ?? [], journeys);
    if (derived.problem) {
      problems.push(`${entry.slug}: ${derived.problem}`);
      listings[entry.slug] = { state: "status_unavailable", configurations: {} };
    } else {
      listings[entry.slug] = { state: "ok", configurations: derived.configurations };
    }
  }
  const harness = deriveHarnessChecks(harnessFiles, journeys);
  if (harness.problem) problems.push(`harness checks: ${harness.problem}`);
  const harnessChecks = harness.problem
    ? { state: "status_unavailable", harnesses: {} }
    : { state: "ok", harnesses: harness.harnesses };
  const status = { generated: { ...GENERATED }, listings, harnessChecks };
  status.bodyDigest = statusBodyDigest(status);
  return { status, problems };
}

// Step 2 for one scope: the records that could label it, settled among themselves. A relation counts only
// from a record in the same scope, so a record that could never earn this label can't change it. Lost
// evidence is never dropped quietly: a record in force whose receipt is missing or changed might be the
// FAIL that decides the label, so it makes the set unavailable (withdraw or supersede it to clear this).
function settleScope(records, { lostMakesUnavailable = true } = {}) {
  const relations = relationsInForce(records);
  if (relations.problem) return relations;
  const live = records.filter((r) => !relations.gone.has(r.record.id));
  const lost = live.find((r) => !r.receiptVerified);
  if (lost && lostMakesUnavailable) return { problem: `${lost.file}: its receipt is missing or changed` };
  return { live: live.filter((r) => r.receiptVerified) };
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
    if (!PLATFORM.test(r.environment.platform) || !ARCH.test(r.environment.arch)) {
      return { problem: `${f.file}: environment ${r.environment.platform}-${r.environment.arch} is not linux|darwin|win32 with x64|arm64` };
    }
    if (ids.has(r.id)) return { problem: `record id ${r.id} appears twice` };
    ids.add(r.id);
    records.push({ ...f, journey });
  }
  return { records };
}

// Step 2, relations. A withdrawal counts only from a record that isn't itself withdrawn, so withdrawing a
// withdrawal restores what it withdrew, and a withdrawn record can't clear a FAIL. That's a fixed point; a
// cycle that never settles makes the set unavailable. A supersession counts from any record not withdrawn,
// so a chain of corrections stays replaced.
function relationsInForce(records) {
  let withdrawn = new Set();
  for (let round = 0; round <= 2 * records.length + 2; round++) {
    const next = new Set();
    for (const { record } of records) {
      if (!withdrawn.has(record.id)) for (const id of record.relations.withdraws) next.add(id);
    }
    if (next.size === withdrawn.size && [...next].every((id) => withdrawn.has(id))) {
      const gone = new Set(withdrawn);
      for (const { record } of records) {
        if (!withdrawn.has(record.id)) for (const id of record.relations.supersedes) gone.add(id);
      }
      return { gone };
    }
    withdrawn = next;
  }
  return { problem: "its withdrawals form a cycle" };
}

// Step 3, match: same source folder, configuration and package. A different package counts only through
// the listing's explicit `evidenceReuse`, and then both digests are shown. Each platform's eligible records
// are one scope for step 2. A record that matches no offered configuration plays no part at all.
function deriveListing(entry, files, journeys) {
  const read = readable(files, "team", journeys);
  if (read.problem) return read;
  const configurations = {};
  for (const cfg of entry.configurations) {
    const current = cfg.packageDigest;
    const accepted = new Set([current.value, ...(cfg.evidenceReuse ?? []).map((reuse) => reuse.packageDigest.value)]);
    const matching = read.records.filter(({ record: { subject } }) =>
      subject.source.repository === entry.source.repository &&
      subject.source.folder === entry.source.folder &&
      subject.configurationId === cfg.id &&
      accepted.has(subject.packageDigest.value));
    const ours = matching.filter((r) => TEAM_LABEL_KINDS.has(r.record.evidence.kind));
    const platforms = {};
    for (const platform of unique(ours.map(environmentOf))) {
      const settled = settleScope(ours.filter((r) => environmentOf(r) === platform));
      if (settled.problem) return { problem: `${cfg.id} on ${platform}: ${settled.problem}` };
      const label = labelFor(settled.live, current);
      if (label) platforms[platform] = label;
    }
    // Community reports settle among themselves for the count. A lost receipt leaves a report out of the
    // count but never makes the listing unavailable, because a count isn't a label.
    const community = settleScope(matching.filter((r) => r.record.evidence.kind === "community-reported"), { lostMakesUnavailable: false });
    if (community.problem) return { problem: `${cfg.id} community reports: ${community.problem}` };
    configurations[cfg.id] = { platforms, communityReports: community.live.length };
  }
  return { configurations };
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
  // A note says what failed (known problem) or what a partial run left out (partly tested).
  if ((label === "known_problem" || label === "partly_tested") && newest.record.outcome.publicNote) out.note = newest.record.outcome.publicNote;
  return out;
}

// Harness checks never make a team label; they're a separate line per harness and platform, from the
// newest record in force. Each harness and platform's eligible records are one scope for step 2.
function deriveHarnessChecks(files, journeys) {
  const read = readable(files, "harness_check", journeys);
  if (read.problem) return read;
  const eligible = read.records.filter((r) => !HARNESS_LINE_EXCLUDED_KINDS.has(r.record.evidence.kind));
  const harnesses = {};
  for (const harness of unique(eligible.map((r) => r.record.subject.harness))) {
    const mine = eligible.filter((r) => r.record.subject.harness === harness);
    for (const platform of unique(mine.map(environmentOf))) {
      const settled = settleScope(mine.filter((r) => environmentOf(r) === platform));
      if (settled.problem) return { problem: `${harness} on ${platform}: ${settled.problem}` };
      if (!settled.live.length) continue;
      const newest = settled.live.reduce((a, b) => (newer(b, a) ? b : a));
      const line = {
        result: harnessResult(newest),
        date: utcDate(newest),
        openrigVersion: newest.record.environment.openrig.version,
        harnessVersion: newest.record.environment.harnesses.find((h) => h.name === harness)?.version ?? "unknown",
        recordIds: [newest.record.id],
      };
      if (newest.record.outcome.publicNote) line.note = newest.record.outcome.publicNote;
      (harnesses[harness] ??= {})[platform] = line;
    }
  }
  return { harnesses };
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
  // Build metadata (+...) doesn't change precedence, so it's parsed and ignored.
  const parse = (v) => /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return Number.NaN;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  if (x[4] === y[4]) return 0;
  if (x[4] === undefined) return 1;
  if (y[4] === undefined) return -1;
  return comparePrerelease(x[4].split("."), y[4].split("."));
}

// SemVer precedence: numeric identifiers compare as numbers and sort before alphanumeric ones; a shorter
// list of otherwise equal identifiers sorts first.
function comparePrerelease(x, y) {
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    const xNumeric = /^\d+$/.test(x[i]);
    const yNumeric = /^\d+$/.test(y[i]);
    if (xNumeric && yNumeric && Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    if (!xNumeric && x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}
