import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { statusBodyDigest } from "../lib/canonical.mjs";
import { compareVersions } from "../lib/status-rule.mjs";
import { generate } from "../status.mjs";
import { CASES, PLANTED, entry, plantedRecord, team } from "./fixtures/status-cases.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Writes one case as an openrig-world tree plus a records tree, each record in its own run folder. */
function materialize({ entry: listing = entry(), files }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "status-case-"));
  const root = path.join(dir, "world");
  fs.mkdirSync(path.join(root, "registry"), { recursive: true });
  fs.writeFileSync(path.join(root, "registry", `${listing.slug}.yaml`), JSON.stringify(listing, null, 2));
  fs.cpSync(path.join(REPO, "status", "journeys"), path.join(root, "status", "journeys"), { recursive: true });
  const records = path.join(dir, "records");
  files.forEach((file, i) => {
    const run = path.join(records, `run-${i}`);
    const group = path.join(run, "run-records", file.group);
    fs.mkdirSync(group, { recursive: true });
    if (file.raw !== undefined) {
      fs.writeFileSync(path.join(group, `raw-${i}.json`), file.raw);
      return;
    }
    const receipt = `receipt for ${file.record.id}\n`;
    const record = structuredClone(file.record);
    record.evidence.receipt.sha256 = sha256(receipt);
    if (file.receipt !== "missing") fs.writeFileSync(path.join(run, "receipt.md"), file.receipt === "changed" ? `${receipt}edited later\n` : receipt);
    fs.writeFileSync(path.join(group, `${record.id}.json`), JSON.stringify(record, null, 2));
  });
  return { dir, root, records };
}

function run(caseInput) {
  const { dir, root, records } = materialize(caseInput);
  try {
    return generate({ root, recordRoots: [records] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Key sets must match exactly, except inside a label or harness line, where the expectation is a subset. */
function assertShape(actual, expected, at) {
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    assert.deepEqual(actual, expected, at);
    return;
  }
  assert.ok(actual && typeof actual === "object", `${at} is missing`);
  if (!("label" in expected) && !("result" in expected)) {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${at} keys`);
  }
  for (const [key, value] of Object.entries(expected)) assertShape(actual[key], value, `${at}.${key}`);
}

for (const c of CASES) {
  test(c.name, () => {
    const result = run(c);
    assert.deepEqual(result.problems, []);
    assertShape(result.status.listings.team, c.expect, "listings.team");
    if (c.expectHarness) assertShape(result.status.harnessChecks, c.expectHarness, "harnessChecks");
    assert.equal(result.status.bodyDigest, statusBodyDigest(result.status));
  });
}

test("regenerating the same records gives identical bytes", () => {
  const input = { files: [{ group: "team", record: team("r1", { assistance: 1 }) }, { group: "team", record: team("r2", { platform: "darwin" }) }] };
  assert.equal(run(input).text, run(input).text);
});

test("private values planted in every private field never reach the status file", () => {
  const result = run({ files: [{ group: "team", record: plantedRecord() }] });
  assert.deepEqual(result.problems, []);
  assert.equal(result.status.listings.team.configurations[Object.keys(result.status.listings.team.configurations)[0]].platforms["linux-x64"].label, "tested_with_help");
  for (const value of PLANTED) assert.ok(!result.text.includes(value), `status carries ${value}`);
});

test("a public note carrying private text stops generation", () => {
  const steps = [["install", "FAIL"]];
  const result = run({ files: [{ group: "team", record: team("r1", { steps, publicNote: `See ${PLANTED[0]} for the log.` }) }] });
  assert.ok(result.problems.some((p) => p.includes("private text (absolute path)")), result.problems.join("\n"));
});

test("a public note naming a private host stops generation", () => {
  const result = run({ files: [{ group: "team", record: team("r1", { steps: [["install", "FAIL"]], publicNote: "Install stopped on mm2-host.local." }) }] });
  assert.ok(result.problems.some((p) => p.includes("private text (private host name)")), result.problems.join("\n"));
});

test("release versions order prereleases by SemVer", () => {
  assert.ok(compareVersions("0.6.6-rc.10", "0.6.6-rc.9") > 0);
  assert.ok(compareVersions("0.6.6", "0.6.6-rc.1") > 0);
  assert.ok(compareVersions("0.6.6-rc.1", "0.6.6-rc") > 0);
  assert.ok(compareVersions("0.6.6-1", "0.6.6-alpha") < 0);
  assert.ok(Number.isNaN(compareVersions("0.6", "0.6.6")));
});

test("records for a slug with no listed entry are reported, not labelled", () => {
  const result = run({ files: [{ group: "other-team", record: team("r1") }] });
  assert.deepEqual(result.problems, []);
  assert.ok(result.warnings.some((w) => w.includes("other-team")));
  assert.deepEqual(Object.keys(result.status.listings), ["team"]);
});
