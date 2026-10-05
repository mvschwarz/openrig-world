#!/usr/bin/env node
// Checks registry entries, their behaviour views, the journeys and the generated status file. It reads this
// repository's files and nothing else: it fetches nothing and runs nothing a submission contains.
//
//   node tools/registry-check.mjs [--root <openrig-world>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { statusBodyDigest } from "./lib/canonical.mjs";
import { configurationIdProblem } from "./lib/config-id.mjs";
import { loadJourneys, loadRegistry, loadSubmissions, loadValidators, readYaml, schemaError } from "./lib/load.mjs";
import { findIllFormedText, findPrivateText } from "./lib/private-patterns.mjs";
import { GENERATED } from "./lib/status-rule.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RECEIVED = "Submission received; a maintainer completes the pinned commit, package digests and views before it's listed.";

/** Every finding as one line; an empty list means the repository passes. */
export function checkRepository(root = REPO) {
  const validators = loadValidators();
  const findings = [...validators.problems];
  for (const item of loadRegistry(root, validators)) {
    if (item.problem) findings.push(misplacedSubmission(root, item.file) ?? `${item.file}: ${item.problem}`);
    else findings.push(...checkEntry(root, item.file, item.entry, validators));
  }
  for (const item of loadSubmissions(root, validators)) if (item.problem) findings.push(`${item.file}: ${item.problem}`);
  findings.push(...loadJourneys(root, validators).problems);
  findings.push(...checkStatus(root, validators));
  return findings;
}

/** Rig names on openrig.dev/rigs are unique; a taken one gets a friendly hint, never a failure. */
export const nameTaken = (name) => `That name is taken. Choose a distinct one, for example ${name}-<your-name>.`;

/** One notice per well-formed submission in `registry/submissions/`. */
export function submissionNotices(root = REPO) {
  const registry = path.join(root, "registry");
  const taken = new Set(fs.existsSync(registry)
    ? fs.readdirSync(registry).filter((n) => n.endsWith(".yaml")).map((n) => n.slice(0, -".yaml".length).toLowerCase())
    : []);
  return loadSubmissions(root, loadValidators()).filter((item) => !item.problem).map((item) => {
    const name = path.basename(item.file).replace(/\.ya?ml$/, "");
    return { file: item.file, message: taken.has(name.toLowerCase()) ? `${RECEIVED} ${nameTaken(name)}` : RECEIVED };
  });
}

// A file here with no configurations can never be an entry; it's most likely a submission in the wrong place, and
// the schema's first error would only mislead. Say where it goes instead.
function misplacedSubmission(root, file) {
  try {
    const value = readYaml(path.join(root, file));
    if (value && typeof value === "object" && !Array.isArray(value) && !("configurations" in value)) {
      return `${file}: this isn't a complete registry entry (it has no configurations). To submit a rig for listing, add ` +
        `registry/submissions/${path.basename(file)} with only repository, folder and ref; a maintainer completes the entry.`;
    }
  } catch {
    // Unreadable YAML: the finding already says so.
  }
  return null;
}

function checkEntry(root, file, entry, validators) {
  const findings = [];
  const say = (message) => findings.push(`${file}: ${message}`);
  if (path.basename(file, ".yaml") !== entry.slug) say(`slug ${entry.slug} must match the file name`);
  const { repository, folder, resolvedCommit, canonicalUrl } = entry.source;
  const expectedUrl = `${repository}/tree/${resolvedCommit}${folder === "." ? "" : `/${folder}`}`;
  if (canonicalUrl !== undefined && canonicalUrl !== expectedUrl) say(`source.canonicalUrl must be ${expectedUrl}`);
  const ids = new Set();
  const aliases = new Set();
  for (const cfg of entry.configurations) {
    const problem = configurationIdProblem(cfg.id);
    if (problem) say(`configuration ${cfg.id}: ${problem}`);
    if (ids.has(cfg.id)) say(`configuration ${cfg.id} appears twice`);
    ids.add(cfg.id);
    if (cfg.alias !== undefined && aliases.has(cfg.alias)) say(`alias ${cfg.alias} appears twice`);
    if (cfg.alias !== undefined) aliases.add(cfg.alias);
    findings.push(...checkBehaviour(root, `${file}: configuration ${cfg.alias ?? cfg.id}`, cfg, validators));
  }
  if (entry.configurations.filter((cfg) => cfg.recommended).length > 1) say("more than one configuration is recommended");
  return findings;
}

// The schema already refuses absolute and `..` paths; the resolve check below is the same rule said twice.
function checkBehaviour(root, where, cfg, validators) {
  const registryDir = path.join(root, "registry");
  const target = path.resolve(registryDir, cfg.behaviour);
  const label = `${where}: behaviour ${cfg.behaviour}`;
  if (!target.startsWith(registryDir + path.sep)) return [`${label} is outside registry/`];
  let view;
  try {
    // Read only inside registry/, through symlinks too.
    const real = fs.realpathSync(target);
    if (!real.startsWith(fs.realpathSync(registryDir) + path.sep)) return [`${label} resolves outside registry/ through a symlink`];
    view = JSON.parse(fs.readFileSync(real, "utf8"));
  } catch {
    return [`${label} is missing or not readable JSON`];
  }
  if (!validators.behaviour(view)) return [`${label} is not a behaviour view v1: ${schemaError(validators.behaviour)}`];
  if (view.state !== "generated") return [];
  const findings = [];
  const { configurationId, packageDigest, assembler } = view.identity;
  if (configurationId !== cfg.id) findings.push(`${label} describes configuration ${configurationId}`);
  if (packageDigest?.value !== cfg.packageDigest.value) findings.push(`${label} describes a different package digest`);
  if (assembler?.openrigVersion !== cfg.assembler.openrigVersion) {
    findings.push(`${label} was generated by OpenRig ${assembler?.openrigVersion}, not ${cfg.assembler.openrigVersion}`);
  }
  return findings;
}

function checkStatus(root, validators) {
  const file = path.join(root, "status", "status.json");
  if (!fs.existsSync(file)) return [];
  let status;
  try {
    status = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return [`status/status.json: not readable JSON: ${error.message}`];
  }
  const findings = [];
  if (!validators.status(status)) {
    findings.push(`status/status.json: not bundle-status v1: ${schemaError(validators.status)}`);
  } else {
    for (const [key, value] of Object.entries(GENERATED)) {
      if (status.generated[key] !== value) findings.push(`status/status.json: generated.${key} must be ${JSON.stringify(value)}`);
    }
    if (status.bodyDigest !== statusBodyDigest(status)) {
      findings.push("status/status.json: bodyDigest does not match the content, so it was edited by hand; regenerate it with tools/status.mjs");
    }
  }
  for (const leak of findPrivateText(status)) findings.push(`status/status.json: private text (${leak.kind}) at ${leak.at}`);
  for (const at of findIllFormedText(status)) findings.push(`status/status.json: text that isn't well-formed Unicode at ${at}`);
  return findings;
}

function main(argv) {
  let root = REPO;
  if (argv[0] === "--root" && argv[1]) root = path.resolve(argv[1]);
  else if (argv.length) {
    console.error("usage: node tools/registry-check.mjs [--root <dir>]");
    return 2;
  }
  const findings = checkRepository(root);
  for (const { file, message } of submissionNotices(root)) {
    console.log(`${file}: ${message}`);
    // Shown on the pull request itself, so a submitter needn't open the log.
    if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice file=${file},title=Submission received::${message}`);
  }
  for (const finding of findings) console.error(finding);
  if (findings.length) {
    console.error(`registry check failed: ${findings.length} finding(s)`);
    return 1;
  }
  console.log("registry check passed");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
