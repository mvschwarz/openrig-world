// The registry check and the generator read local files and nothing else. This pins what they may import
// and refuses the obvious ways to reach the network or run a program.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set(["node:fs", "node:path", "node:url", "node:crypto", "yaml", "ajv/dist/2020.js", "ajv-formats"]);
const FORBIDDEN = /child_process|node:(http|https|net|tls|dgram|dns|worker_threads)\b|\bfetch\s*\(|\beval\s*\(|new\s+Function\b|\bimport\s*\(/;

const sources = ["", "lib"].flatMap((dir) =>
  fs.readdirSync(path.join(TOOLS, dir)).filter((name) => name.endsWith(".mjs")).map((name) => path.join(TOOLS, dir, name)));

test("the tools import only local files, node:fs/path/url/crypto, yaml and ajv", () => {
  assert.ok(sources.length >= 6, `found ${sources.length} sources`);
  for (const file of sources) {
    const text = fs.readFileSync(file, "utf8");
    for (const [, specifier] of text.matchAll(/^\s*import\s[^;]*?\sfrom\s+"([^"]+)"/gm)) {
      assert.ok(specifier.startsWith("./") || ALLOWED.has(specifier), `${path.relative(TOOLS, file)} imports ${specifier}`);
    }
    assert.doesNotMatch(text, FORBIDDEN, path.relative(TOOLS, file));
  }
});
