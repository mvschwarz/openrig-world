import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { statusBodyDigest } from "../lib/canonical.mjs";
import { readYaml } from "../lib/load.mjs";
import { RECEIVED, checkRepository, nameTaken, submissionNotices } from "../registry-check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const fixture = (name) => fs.readFileSync(path.join(HERE, "fixtures", name), "utf8");
const VALID_ENTRY = fixture("registry-valid.yaml");
const VIEW_PATH = readYaml(path.join(HERE, "fixtures", "registry-valid.yaml")).configurations[0].behaviour;
const VIEW = fixture("behaviour-generated.json");

/** A temporary openrig-world tree: registry files by name, views by registry path, an optional status file. */
function check({ entries = { "openrig-dev.yaml": VALID_ENTRY }, views = { [VIEW_PATH]: VIEW }, status, withNotices = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "registry-check-"));
  try {
    for (const [name, text] of Object.entries(entries)) write(root, `registry/${name}`, text);
    for (const [name, text] of Object.entries(views)) write(root, `registry/${name}`, text);
    fs.cpSync(path.join(REPO, "status", "journeys"), path.join(root, "status", "journeys"), { recursive: true });
    if (status !== undefined) write(root, "status/status.json", typeof status === "string" ? status : JSON.stringify(status, null, 2));
    if (withNotices) return { findings: checkRepository(root), notices: submissionNotices(root) };
    return checkRepository(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}

const has = (findings, text) => assert.ok(findings.some((f) => f.includes(text)), `expected a finding with "${text}", got:\n${findings.join("\n")}`);

test("this repository as committed passes", () => {
  assert.deepEqual(checkRepository(REPO), []);
});

const SUBMISSION = "repository: https://github.com/someone/rigs\nfolder: rigs/my-team\nref: main\n";
const withEntry = (files) => ({ "openrig-dev.yaml": VALID_ENTRY, ...files });

test("a submission with repository, folder and ref passes and is acknowledged", () => {
  for (const name of ["my-team.yaml", "my-team.yml"]) {
    const { findings, notices } = check({ entries: withEntry({ [`submissions/${name}`]: SUBMISSION }), withNotices: true });
    assert.deepEqual(findings, [], name);
    assert.deepEqual(notices, [{ file: `registry/submissions/${name}`, message: RECEIVED }], name);
  }
});

test("a submission whose name is already listed still passes, with a hint to choose a distinct name", () => {
  for (const name of ["openrig-dev.yaml", "OpenRig-Dev.yml"]) {
    const { findings, notices } = check({ entries: withEntry({ [`submissions/${name}`]: SUBMISSION }), withNotices: true });
    assert.deepEqual(findings, [], name);
    const stem = name.replace(/\.ya?ml$/, "");
    assert.deepEqual(notices, [{ file: `registry/submissions/${name}`, message: `${RECEIVED} ${nameTaken(stem)}` }], name);
    assert.ok(notices[0].message.endsWith(`for example ${stem}-<your-name>.`), name);
  }
  const free = check({ entries: withEntry({ "submissions/openrig-dev-alice.yaml": SUBMISSION }), withNotices: true });
  assert.deepEqual(free.notices, [{ file: "registry/submissions/openrig-dev-alice.yaml", message: RECEIVED }]);
});

test("a malformed submission fails with what a submission needs", () => {
  for (const [name, text] of [
    ["no-ref.yaml", "repository: https://github.com/someone/rigs\nfolder: rigs/my-team\n"],
    ["not-github.yaml", "repository: https://gitlab.com/someone/rigs\nfolder: rigs/my-team\nref: main\n"],
    ["parent-folder.yaml", "repository: https://github.com/someone/rigs\nfolder: ../elsewhere\nref: main\n"],
    ["extra-field.yaml", `${SUBMISSION}packageDigest: abc\n`],
    ["notes.json", "{}"],
  ]) {
    const { findings, notices } = check({ entries: withEntry({ [`submissions/${name}`]: text }), withNotices: true });
    has(findings, "a submission has exactly three fields: repository");
    assert.deepEqual(notices, [], name);
  }
});

test("a file name that could break CI output is quoted, never echoed", () => {
  const { findings, notices } = check({ entries: withEntry({ "submissions/x\n::warning::y.yaml": SUBMISSION }), withNotices: true });
  has(findings, 'registry/submissions/"x\\n::warning::y.yaml"');
  assert.ok(findings.every((f) => !f.includes("\n")), findings.join(" | "));
  assert.deepEqual(notices, []);
});

test("a submission placed beside the entries is pointed to submissions/; a broken full entry is not", () => {
  has(check({ entries: withEntry({ "my-team.yaml": SUBMISSION }) }), "add registry/submissions/my-team.yaml with only repository, folder and ref");
  const broken = check({ entries: { "openrig-dev.yaml": VALID_ENTRY.replace(/^review:[\s\S]*?(?=^status:)/m, "") } });
  has(broken, "not a registry entry v1");
  assert.ok(broken.every((f) => !f.includes("registry/submissions/")), broken.join("\n"));
});

test("a valid entry with its behaviour view passes", () => {
  assert.deepEqual(check(), []);
});

test("malformed YAML is rejected", () => {
  has(check({ entries: { "openrig-dev.yaml": "slug: [openrig-dev\nname: x\n" } }), "not readable YAML");
});

test("a duplicated key is rejected", () => {
  has(check({ entries: { "openrig-dev.yaml": `${VALID_ENTRY}status: withdrawn\n` } }), "not readable YAML");
});

test("a short commit is rejected", () => {
  has(check({ entries: { "openrig-dev.yaml": fixture("registry-short-commit.yaml") } }), "not a registry entry v1");
});

test("a 40-character commit that isn't hex is rejected", () => {
  const entry = VALID_ENTRY.replace(/resolvedCommit: [0-9a-f]{40}/, `resolvedCommit: ${"g".repeat(40)}`);
  assert.notEqual(entry, VALID_ENTRY);
  has(check({ entries: { "openrig-dev.yaml": entry } }), "resolvedCommit");
});

test("the slug must match the file name", () => {
  has(check({ entries: { "another-name.yaml": VALID_ENTRY } }), "must match the file name");
});

test("a configuration ID out of order is rejected", () => {
  const entry = VALID_ENTRY.replace(
    "id: build.impl=claude-code,build.lead=claude-code,check.qa=codex,check.review=codex",
    "id: build.lead=claude-code,build.impl=claude-code,check.qa=codex,check.review=codex");
  assert.notEqual(entry, VALID_ENTRY);
  has(check({ entries: { "openrig-dev.yaml": entry } }), "not sorted");
});

test("a missing behaviour view is rejected", () => {
  has(check({ views: {} }), "missing or not readable JSON");
});

test("a behaviour view for another package is rejected", () => {
  const view = JSON.parse(VIEW);
  view.identity.packageDigest.value = "0".repeat(64);
  has(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), "different package digest");
});

test("setup commands in a behaviour view must be a list of text lines", () => {
  const view = JSON.parse(VIEW);
  view.needs.push({ kind: "precondition", name: "Prepare the source clone", commands: ["cd openrig", "npm ci"], status: "not_checked", sourceRefs: [{ path: "bundle.yaml", field: "preconditions[0]" }] });
  assert.deepEqual(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), []);
  view.needs.at(-1).commands = "cd openrig && npm ci";
  has(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), "not a behaviour view v1");
});

test("permission prompts in a behaviour view must be off, on or default", () => {
  const view = JSON.parse(VIEW);
  view.posture[0].permissionPrompts = "default";
  assert.deepEqual(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), []);
  view.posture[0].permissionPrompts = "sometimes";
  has(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), "not a behaviour view v1");
});

test("a seat on a need or an unknown must be pod.member", () => {
  for (const list of ["needs", "unknownBeforeLaunch"]) {
    const view = JSON.parse(VIEW);
    view[list][0].seat = "build.lead";
    assert.deepEqual(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), [], list);
    view[list][0].seat = "lead";
    has(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), "not a behaviour view v1");
  }
});

test("the non-interruptive posture facts accept only their declared values", () => {
  const view = JSON.parse(VIEW);
  view.posture[0].nonInterruptive = "available";
  view.posture[0].firstRunWarnings = { claudeBypass: "harness_asks_once" };
  assert.deepEqual(check({ views: { [VIEW_PATH]: JSON.stringify(view) } }), []);
  for (const [field, value] of [["nonInterruptive", "selected"], ["firstRunWarnings", { claudeBypass: "accepted" }]]) {
    const changed = JSON.parse(JSON.stringify(view));
    changed.posture[0][field] = value;
    has(check({ views: { [VIEW_PATH]: JSON.stringify(changed) } }), "not a behaviour view v1");
  }
});

test("a generated status file passes", () => {
  assert.deepEqual(check({ status: fixture("status-valid.json") }), []);
});

test("a hand-edited status file is rejected", () => {
  const status = JSON.parse(fixture("status-valid.json"));
  const [listing] = Object.values(status.listings);
  const [configuration] = Object.values(listing.configurations).filter((c) => Object.keys(c.platforms).length);
  Object.values(configuration.platforms)[0].openrigVersion = "9.9.9";
  has(check({ status }), "edited by hand");
});

test("a status file with its notice changed is rejected", () => {
  assert.ok(check({ status: fixture("status-hand-edited-notice.json") }).length > 0);
});

test("private text in a status file is rejected even with a recomputed digest", () => {
  const status = JSON.parse(fixture("status-valid.json"));
  const pi = Object.values(status.harnessChecks.harnesses)[0];
  Object.values(pi)[0].note = "Log at /Users/someone/run.log";
  status.bodyDigest = statusBodyDigest(status);
  has(check({ status }), "private text (absolute path)");
});

test("a behaviour view that resolves outside registry/ through a symlink is rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "registry-check-link-"));
  try {
    write(root, "registry/openrig-dev.yaml", VALID_ENTRY);
    write(root, "outside/view.json", VIEW);
    fs.mkdirSync(path.dirname(path.join(root, "registry", VIEW_PATH)), { recursive: true });
    fs.symlinkSync(path.join(root, "outside/view.json"), path.join(root, "registry", VIEW_PATH));
    fs.cpSync(path.join(REPO, "status", "journeys"), path.join(root, "status", "journeys"), { recursive: true });
    has(checkRepository(root), "resolves outside registry/ through a symlink");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a status file with text that isn't well-formed Unicode is rejected", () => {
  const status = JSON.parse(fixture("status-valid.json"));
  const pi = Object.values(status.harnessChecks.harnesses)[0];
  Object.values(pi)[0].note = "Unpaired " + String.fromCharCode(0xd800);
  status.bodyDigest = statusBodyDigest(status);
  has(check({ status }), "well-formed Unicode");
});
