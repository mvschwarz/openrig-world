// Status rule fixtures: each case is a registry entry, some run records (each in its own run folder with its
// receipt), and the labels the rule must produce. The test writes them to a temporary folder and runs the
// real generator over it.
export const DIGEST_A = { algorithm: "sha256", value: "a".repeat(64), coverage: "openrig.package-digest/v1" };
export const DIGEST_B = { algorithm: "sha256", value: "b".repeat(64), coverage: "openrig.package-digest/v1" };
const SOURCE = { repository: "https://github.com/example/rigs", folder: "team", resolvedCommit: "1".repeat(40) };
export const MIX = "dev.impl=claude-code,dev.review=codex";
const STEPS = ["install", "launch", "orient", "pull-request", "merged"];
const ALL_PASS = STEPS.map((id) => [id, "PASS"]);

export function entry({ digest = DIGEST_A, openrig = "0.6.6", evidenceReuse } = {}) {
  const cfg = { id: MIX, alias: "recommended", recommended: true, packageDigest: digest, assembler: { openrigVersion: openrig }, behaviour: "views/team/recommended.json" };
  if (evidenceReuse) cfg.evidenceReuse = evidenceReuse;
  return { schema: "openrig.registry-entry/v1", slug: "team", name: "Example team", source: SOURCE, configurations: [cfg], review: { date: "2026-10-04" }, status: "listed" };
}

/** A team run record; `receipt.sha256` is filled in by the test from the receipt it writes. */
export function team(id, { steps = ALL_PASS, assistance = 0, platform = "linux", openrig = "0.6.6", digest = DIGEST_A, kind = "native-workflow", at = "2026-10-04T10:00:00Z", relations = {}, publicNote, recordedBy = "fleet", assistanceText = "a person typed one command for the seat" } = {}) {
  const outcome = { steps: steps.map(([step, result]) => ({ id: step, result })), assistance: { count: assistance }, recordedBy, at };
  if (assistance) outcome.assistance.description = assistanceText;
  if (publicNote) outcome.publicNote = publicNote;
  return {
    schema: "openrig.run-record/v1", id,
    subject: { kind: "team", source: SOURCE, configurationId: MIX, packageDigest: digest, assembler: { openrigVersion: openrig } },
    execution: { resources: [], settings: {}, unknowns: [] },
    environment: { openrig: { version: openrig }, platform, arch: "x64", harnesses: [{ name: "claude-code", version: "2.1.220", knownBy: "claude --version" }] },
    evidence: { kind, receipt: { ref: "receipt.md", sha256: "" } },
    journey: { id: "contributor-team", version: 1 },
    outcome,
    relations: { supersedes: [], withdraws: [], resolves: [], ...relations },
  };
}

export function harness(id, { harnessName = "pi", steps = [["on-path", "PASS"], ["version-supported", "PASS"], ["signed-in", "BLOCKED"]], publicNote, at = "2026-10-04T11:00:00Z" } = {}) {
  const record = team(id, { at, publicNote });
  record.subject = { kind: "harness_check", harness: harnessName };
  record.journey = { id: "harness-check", version: 1 };
  record.environment.harnesses = [{ name: harnessName, version: "0.9.1", knownBy: "pi --version" }];
  record.outcome.steps = steps.map(([step, result]) => ({ id: step, result }));
  return record;
}

const ok = (configuration) => ({ state: "ok", configurations: { [MIX]: configuration } });
const FAIL_MERGED = STEPS.map((id) => [id, id === "merged" ? "FAIL" : "PASS"]);

// `files`: { group, record } | { group, raw } with optional `receipt` ("missing" or "changed").
export const CASES = [
  {
    name: "a plain pass is Tested by OpenRig",
    files: [{ group: "team", record: team("r1") }],
    expect: ok({ platforms: { "linux-x64": { label: "tested", recordIds: ["r1"], openrigVersion: "0.6.6" } }, communityReports: 0 }),
  },
  {
    name: "an assisted pass is Tested with help (N)",
    files: [{ group: "team", record: team("r1", { assistance: 2 }) }],
    expect: ok({ platforms: { "linux-x64": { label: "tested_with_help", assistanceCount: 2 } }, communityReports: 0 }),
  },
  {
    name: "a partial run is Partly tested",
    files: [{ group: "team", record: team("r1", { steps: [["install", "PASS"], ["launch", "PASS"], ["orient", "BLOCKED"]] }) }],
    expect: ok({ platforms: { "linux-x64": { label: "partly_tested" } }, communityReports: 0 }),
  },
  {
    name: "a readable PASS whose receipt was deleted supports nothing",
    files: [{ group: "team", record: team("r1"), receipt: "missing" }],
    expect: ok({ platforms: {}, communityReports: 0 }),
  },
  {
    name: "a PASS whose receipt changed after the record supports nothing",
    files: [{ group: "team", record: team("r1"), receipt: "changed" }],
    expect: ok({ platforms: {}, communityReports: 0 }),
  },
  {
    name: "a zero-assistance PASS corrected to assisted shows the correction",
    files: [
      { group: "team", record: team("r1") },
      { group: "team", record: team("r2", { assistance: 1, at: "2026-10-04T12:00:00Z", relations: { supersedes: ["r1"] } }) },
    ],
    expect: ok({ platforms: { "linux-x64": { label: "tested_with_help", assistanceCount: 1, recordIds: ["r2"] } }, communityReports: 0 }),
  },
  {
    name: "resolves from a BLOCKED record leaves the known problem",
    files: [
      { group: "team", record: team("r1", { steps: FAIL_MERGED, publicNote: "The pull request was never merged." }) },
      { group: "team", record: team("r2", { steps: [["merged", "BLOCKED"]], at: "2026-10-04T12:00:00Z", relations: { resolves: [{ record: "r1", step: "merged" }] } }) },
    ],
    expect: ok({ platforms: { "linux-x64": { label: "known_problem", recordIds: ["r1"], note: "The pull request was never merged." } }, communityReports: 0 }),
  },
  {
    name: "resolves from a withdrawn record leaves the known problem",
    files: [
      { group: "team", record: team("r1", { steps: FAIL_MERGED }) },
      { group: "team", record: team("r2", { at: "2026-10-04T12:00:00Z", relations: { resolves: [{ record: "r1", step: "merged" }] } }) },
      { group: "team", record: team("r3", { steps: [["install", "NOT_RUN"]], at: "2026-10-04T13:00:00Z", relations: { withdraws: ["r2"] } }) },
    ],
    expect: ok({ platforms: { "linux-x64": { label: "known_problem", recordIds: ["r1"] } }, communityReports: 0 }),
  },
  {
    name: "a PASS on a newer OpenRig that names the FAIL resolves it",
    files: [
      { group: "team", record: team("r1", { steps: FAIL_MERGED }) },
      { group: "team", record: team("r2", { openrig: "0.6.7", at: "2026-10-05T10:00:00Z", relations: { resolves: [{ record: "r1", step: "merged" }] } }) },
    ],
    expect: ok({ platforms: { "linux-x64": { label: "tested", recordIds: ["r2"], openrigVersion: "0.6.7" } }, communityReports: 0 }),
  },
  {
    name: "a PASS on an older OpenRig doesn't resolve a FAIL",
    files: [
      { group: "team", record: team("r1", { steps: FAIL_MERGED, openrig: "0.6.7" }) },
      { group: "team", record: team("r2", { openrig: "0.6.6", at: "2026-10-05T10:00:00Z", relations: { resolves: [{ record: "r1", step: "merged" }] } }) },
    ],
    expect: ok({ platforms: { "linux-x64": { label: "known_problem", recordIds: ["r1"] } }, communityReports: 0 }),
  },
  {
    name: "an unreadable record makes the listing Status unavailable, not Not tested",
    files: [{ group: "team", record: team("r1") }, { group: "team", raw: "{ this is not JSON" }],
    expect: { state: "status_unavailable", configurations: {} },
  },
  {
    name: "a record that isn't run record v1 makes the listing Status unavailable",
    files: [{ group: "team", raw: JSON.stringify({ schema: "openrig.run-record/v1", id: "r1" }) }],
    expect: { state: "status_unavailable", configurations: {} },
  },
  {
    name: "a record naming an unknown journey makes the listing Status unavailable",
    files: [{ group: "team", record: { ...team("r1"), journey: { id: "contributor-team", version: 9 } } }],
    expect: { state: "status_unavailable", configurations: {} },
  },
  {
    name: "a record from an environment the status format can't name makes the listing Status unavailable",
    files: [{ group: "team", record: { ...team("r1"), environment: { ...team("r1").environment, platform: "freebsd" } } }],
    expect: { state: "status_unavailable", configurations: {} },
  },
  {
    name: "a Linux PASS and a macOS FAIL are labelled per platform",
    files: [
      { group: "team", record: team("r1") },
      { group: "team", record: team("r2", { platform: "darwin", steps: FAIL_MERGED, publicNote: "Launch stopped on macOS." }) },
    ],
    expect: ok({ platforms: { "linux-x64": { label: "tested" }, "darwin-x64": { label: "known_problem", note: "Launch stopped on macOS." } }, communityReports: 0 }),
  },
  {
    name: "an EVIDENCE.md-only change with evidenceReuse keeps the label and shows both packages",
    entry: entry({ digest: DIGEST_B, evidenceReuse: [{ packageDigest: DIGEST_A, reason: "Only EVIDENCE.md changed." }] }),
    files: [{ group: "team", record: team("r1", { digest: DIGEST_A }) }],
    expect: ok({ platforms: { "linux-x64": { label: "tested", packageDigests: [DIGEST_B, DIGEST_A] } }, communityReports: 0 }),
  },
  {
    name: "an agents/ change without evidenceReuse is Not tested",
    entry: entry({ digest: DIGEST_B }),
    files: [{ group: "team", record: team("r1", { digest: DIGEST_A }) }],
    expect: ok({ platforms: {}, communityReports: 0 }),
  },
  {
    name: "a newer OpenRig release keeps the label, dated with the version that ran",
    entry: entry({ openrig: "0.6.7" }),
    files: [{ group: "team", record: team("r1", { openrig: "0.6.6" }) }],
    expect: ok({ platforms: { "linux-x64": { label: "tested", openrigVersion: "0.6.6", date: "2026-10-04" } }, communityReports: 0 }),
  },
  {
    name: "a community report is counted separately and never labels",
    files: [{ group: "team", record: team("r1", { kind: "community-reported" }) }],
    expect: ok({ platforms: {}, communityReports: 1 }),
  },
  {
    name: "a harness check is its own line and never upgrades a team label",
    files: [{ group: "_harness", record: harness("h1", { publicNote: "Pi was not signed in on the test machine." }) }],
    expect: ok({ platforms: {}, communityReports: 0 }),
    expectHarness: { state: "ok", harnesses: { pi: { "linux-x64": { result: "BLOCKED", harnessVersion: "0.9.1", recordIds: ["h1"], note: "Pi was not signed in on the test machine." } } } },
  },
  {
    name: "an unreadable harness-check record makes harness checks Status unavailable",
    files: [{ group: "team", record: team("r1") }, { group: "_harness", raw: "not json" }],
    expect: ok({ platforms: { "linux-x64": { label: "tested" } }, communityReports: 0 }),
    expectHarness: { state: "status_unavailable", harnesses: {} },
  },
];

// Private values planted in every private field of a record; none may appear in the status file.
export const PLANTED = ["/Users/someone/receipts", "dev-qa@v-openrig-build", "mm2-host.local", "qitem-20261004-abc", "private help text"];
export function plantedRecord() {
  const record = team("r1", { assistance: 1, recordedBy: PLANTED[1], assistanceText: `${PLANTED[4]} at ${PLANTED[0]} on ${PLANTED[2]} for ${PLANTED[3]}` });
  record.execution = { resources: [{ path: PLANTED[0] }], settings: { host: PLANTED[2] }, unknowns: [PLANTED[3]] };
  record.environment.harnesses[0].knownBy = `ran on ${PLANTED[2]}`;
  return record;
}
