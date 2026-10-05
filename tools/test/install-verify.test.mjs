import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { deliveryOf, verifyInstall } from "../install-verify.mjs";
import { makeInstalled } from "./fixtures/install-verify/make-installed.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.join(HERE, "fixtures", "install-verify", "bundle");
const SCRIPT = path.join(HERE, "..", "install-verify.mjs");

function withInstall(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-verify-"));
  try { return fn(makeInstalled(dir)); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const statusOf = (seat, item) => seat.items.find((i) => i.item === item)?.status;
const bySeat = (seats) => Object.fromEntries(seats.map((s) => [s.seat, s]));

test("reports present, missing and unknown per seat in its runtime's own locations", () => withInstall(({ cwd, home }) => {
  const seats = bySeat(verifyInstall({ bundleDir: BUNDLE, cwd, home }));
  const lead = seats["build.lead"], review = seats["check.review"];
  assert.equal(lead.runtime, "claude-code");
  assert.equal(statusOf(lead, "managed block target"), "present");
  assert.equal(statusOf(lead, "culture file (OpenRig default)"), "present");
  assert.equal(statusOf(lead, "culture file"), "present");
  assert.equal(statusOf(lead, "startup files: startup/context.md"), "unknown");
  assert.equal(statusOf(lead, "startup files: startup/rules.md"), "present");
  assert.equal(statusOf(lead, "skills: notes"), "present");
  assert.equal(statusOf(lead, "plugins: kit"), "present");
  // The plugin is projected, but Claude Code reads skills from .claude/skills, not .claude/plugins.
  assert.equal(statusOf(lead, "skills: handoff"), "missing");
  assert.equal(statusOf(lead, "skills: map"), "missing");
  assert.equal(statusOf(lead, "resource: activity-hooks"), "present");
  assert.equal(statusOf(lead, "mcp servers: docs"), "present");
  assert.equal(statusOf(lead, "mcp servers: search"), "missing");

  assert.equal(review.runtime, "codex");
  assert.equal(statusOf(review, "managed block target"), "present");
  assert.equal(statusOf(review, "startup files: startup/rules.md"), "missing");
  assert.equal(statusOf(review, "skills: notes"), "missing");
  assert.equal(statusOf(review, "skills: handoff"), "present");
  assert.equal(review.items.find((i) => i.item === "skills: map")?.where, "~/.agents/skills/map/SKILL.md");
  // A Claude-only resource is not declared for a Codex seat, so it isn't reported there.
  assert.equal(statusOf(review, "resource: activity-hooks"), undefined);
}));

test("without --home a skill not in the project's folder is unknown, and --home settles it", () => withInstall(({ cwd, home }) => {
  const without = bySeat(verifyInstall({ bundleDir: BUNDLE, cwd }))["check.review"];
  assert.equal(statusOf(without, "skills: map"), "unknown");
  assert.match(without.items.find((i) => i.item === "skills: map").detail, /^not found in the project's skill folder; pass --home to check the user's/);
  assert.equal(statusOf(without, "skills: handoff"), "present"); // the project folder still decides when it has the skill
  const withHome = bySeat(verifyInstall({ bundleDir: BUNDLE, cwd, home }))["check.review"];
  assert.equal(statusOf(withHome, "skills: map"), "present");
  assert.equal(statusOf(withHome, "skills: notes"), "missing");
}));

test("a preset switches the runtime and the locations checked", () => withInstall(({ cwd, home }) => {
  const review = bySeat(verifyInstall({ bundleDir: BUNDLE, cwd, home, preset: "all-claude" }))["check.review"];
  assert.equal(review.runtime, "claude-code");
  assert.equal(statusOf(review, "managed block target"), "present");
  assert.equal(review.items.find((i) => i.item === "managed block target")?.where, "CLAUDE.local.md");
  assert.equal(statusOf(review, "resource: activity-hooks"), "present");
}));

test("an empty working directory reports missing, and a missing plugin copy leaves its skills unknown", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-verify-empty-"));
  try {
    const lead = bySeat(verifyInstall({ bundleDir: BUNDLE, cwd: dir }))["build.lead"];
    assert.equal(statusOf(lead, "managed block target"), "missing");
    assert.equal(statusOf(lead, "culture file"), "missing");
    assert.equal(statusOf(lead, "plugins: kit"), "missing");
    assert.equal(statusOf(lead, "plugins: kit skills"), "unknown");
    assert.equal(statusOf(lead, "resource: activity-hooks"), "missing");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("declared lists use the seat-side check's keys", () => withInstall(({ cwd }) => {
  const out = execFileSync(process.execPath, [SCRIPT, "--bundle", BUNDLE, "--cwd", cwd, "--declared", "build.lead"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), { skills: ["notes", "handoff", "map"], plugins: ["kit"], mcp_servers: ["docs", "search"] });
}));

test("always exits 0, including bad input", () => {
  const run = (args) => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.doesNotThrow(() => run([]));
  const out = run(["--bundle", path.join(HERE, "no-such-bundle"), "--cwd", HERE, "--json"]);
  assert.equal(JSON.parse(out).seats[0].items[0].status, "unknown");
});

test("startup file delivery follows OpenRig's hint rules", () => {
  assert.equal(deliveryOf({ path: "a/SKILL.md" }), "skill_install");
  assert.equal(deliveryOf({ path: "notes.md" }), "guidance_merge");
  assert.equal(deliveryOf({ path: "notes.txt" }), "send_text");
  assert.equal(deliveryOf({ path: "notes.md", delivery_hint: "send_text" }), "send_text");
});
