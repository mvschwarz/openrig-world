#!/usr/bin/env node
// Generates status/status.json from private run records (rule openrig.status-rule/v1), or checks that the
// committed file equals regenerated output. Run it where the records and their receipts are.
//
//   node tools/status.mjs generate --records <dir> [--records <dir> ...] [--root <openrig-world>] [--out <file>]
//   node tools/status.mjs check    --records <dir> [--records <dir> ...] [--root <openrig-world>] [--out <file>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalFile } from "./lib/canonical.mjs";
import { loadJourneys, loadRecords, loadRegistry, loadValidators, schemaError } from "./lib/load.mjs";
import { findPrivateText } from "./lib/private-patterns.mjs";
import { deriveStatus } from "./lib/status-rule.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Everything `generate` and `check` need; `problems` non-empty means nothing may be written. */
export function generate({ root = REPO, recordRoots }) {
  const validators = loadValidators();
  const problems = [...validators.problems];
  const registry = loadRegistry(root, validators);
  for (const item of registry) if (item.problem) problems.push(`${item.file}: ${item.problem}`);
  const { journeys, problems: journeyProblems } = loadJourneys(root, validators);
  problems.push(...journeyProblems);
  if (problems.length) return { problems, unavailable: [], warnings: [] };

  const entries = registry.map((item) => item.entry);
  const { teamFiles, harnessFiles, warnings } = loadRecords(recordRoots, validators);
  const listed = new Set(entries.filter((e) => e.status === "listed").map((e) => e.slug));
  for (const slug of teamFiles.keys()) if (!listed.has(slug)) warnings.push(`records for ${slug}, which has no listed registry entry, were not used`);

  const { status, problems: unavailable } = deriveStatus({ entries, teamFiles, harnessFiles, journeys });
  if (!validators.status(status)) problems.push(`the generated status is not bundle-status v1: ${schemaError(validators.status)}`);
  for (const leak of findPrivateText(status)) problems.push(`the generated status carries private text (${leak.kind}) at ${leak.at}`);
  return { status, text: canonicalFile(status), problems, unavailable, warnings };
}

function main(argv) {
  const [command, ...rest] = argv;
  const recordRoots = [];
  let root = REPO;
  let out = null;
  for (let i = 0; i < rest.length; i++) {
    const value = rest[i + 1];
    if (rest[i] === "--records" && value) recordRoots.push(path.resolve(value));
    else if (rest[i] === "--root" && value) root = path.resolve(value);
    else if (rest[i] === "--out" && value) out = path.resolve(value);
    else return usage(`unknown or incomplete argument: ${rest[i]}`);
    i++;
  }
  if (!["generate", "check"].includes(command) || recordRoots.length === 0) return usage();
  out ??= path.join(root, "status", "status.json");

  const result = generate({ root, recordRoots });
  for (const warning of result.warnings) console.error(`warning: ${warning}`);
  for (const reason of result.unavailable) console.error(`status unavailable: ${reason}`);
  if (result.problems.length) {
    for (const problem of result.problems) console.error(`error: ${problem}`);
    console.error("nothing was written");
    return 1;
  }
  if (command === "generate") {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, result.text);
    console.log(`wrote ${out} (bodyDigest ${result.status.bodyDigest})`);
    return 0;
  }
  const committed = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
  if (committed === result.text) {
    console.log(`${out} equals regenerated output`);
    return 0;
  }
  console.error(committed === null ? `${out} does not exist` : `${out} differs from regenerated output; run generate`);
  return 1;
}

function usage(reason) {
  if (reason) console.error(reason);
  console.error("usage: node tools/status.mjs generate|check --records <dir> [--records <dir> ...] [--root <dir>] [--out <file>]");
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
