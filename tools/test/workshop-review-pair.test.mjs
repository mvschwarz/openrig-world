import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// rigs/workshop-review-pair is Workshop with a second reviewer. A bundle must carry its agent inside its own folder,
// so the pair keeps a copy of Workshop's agent, culture and bundle metadata. This keeps the copy from drifting:
// edit rigs/workshop, then copy the same change across.
const RIGS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "rigs");
const SHARED = ["agents", "CULTURE.md", "bundle.yaml"];

function files(root, rel) {
  const full = path.join(root, rel);
  if (!fs.statSync(full).isDirectory()) return [rel];
  return fs.readdirSync(full).sort().flatMap((name) => files(root, path.join(rel, name)));
}

test("the review-pair rig shares Workshop's agent, culture and bundle metadata byte for byte", () => {
  const workshop = path.join(RIGS, "workshop"), pair = path.join(RIGS, "workshop-review-pair");
  for (const entry of SHARED) {
    const expected = files(workshop, entry);
    assert.deepEqual(files(pair, entry), expected, `${entry}: the same files in both folders`);
    for (const file of expected) {
      assert.ok(fs.readFileSync(path.join(pair, file)).equals(fs.readFileSync(path.join(workshop, file))),
        `${file} differs; copy the change from rigs/workshop`);
    }
  }
});
