// Reads registry entries, journeys, run records and receipts from disk. Local files only: nothing here
// fetches, executes or launches anything.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";
import { sha256Hex } from "./canonical.mjs";

const SCHEMAS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schemas");
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
export const HARNESS_FOLDER = "_harness";

/**
 * Compiles the vendored product schemas after checking each file against the pin in
 * schemas/product/source.json, plus the journey schema this repository owns.
 */
export function loadValidators() {
  const pin = JSON.parse(fs.readFileSync(path.join(SCHEMAS, "product", "source.json"), "utf8"));
  const problems = [];
  const ajv = new Ajv2020({ strict: false, allErrors: false });
  addFormats(ajv, ["date", "date-time"]);
  for (const [name, expected] of Object.entries(pin.files)) {
    const bytes = fs.readFileSync(path.join(SCHEMAS, "product", name));
    const actual = sha256Hex(bytes);
    if (actual !== expected) problems.push(`schemas/product/${name}: sha256 ${actual} does not match the pin ${expected}`);
    ajv.addSchema(JSON.parse(bytes.toString("utf8")));
  }
  const journey = JSON.parse(fs.readFileSync(path.join(SCHEMAS, "journey.v1.schema.json"), "utf8"));
  ajv.addSchema(journey);
  const submission = JSON.parse(fs.readFileSync(path.join(SCHEMAS, "registry-submission.v1.schema.json"), "utf8"));
  ajv.addSchema(submission);
  const get = (id) => ajv.getSchema(id);
  return {
    problems,
    runRecord: get("https://openrig.dev/schemas/run-record.v1.json"),
    status: get("https://openrig.dev/schemas/bundle-status.v1.json"),
    registryEntry: get("https://openrig.dev/schemas/registry-entry.v1.json"),
    behaviour: get("https://openrig.dev/schemas/bundle-behaviour.v1.json"),
    journey: get(journey.$id),
    submission: get(submission.$id),
  };
}

/** The first schema error as one readable line. */
export function schemaError(validate) {
  const e = validate.errors?.[0];
  return e ? `${e.instancePath || "(root)"} ${e.message}` : "invalid";
}

export function readYaml(file) {
  const doc = parseDocument(fs.readFileSync(file, "utf8"), { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors[0].message.split("\n")[0]);
  return doc.toJS();
}

/** `registry/*.yaml` as `{ file, entry?, problem? }`, sorted by file name. */
export function loadRegistry(root, validators) {
  const dir = path.join(root, "registry");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(".yaml")).sort().map((name) => {
    const file = `registry/${name}`;
    let entry;
    try {
      entry = readYaml(path.join(dir, name));
    } catch (error) {
      return { file, problem: `not readable YAML: ${error.message}` };
    }
    if (!validators.registryEntry(entry)) return { file, problem: `not a registry entry v1: ${schemaError(validators.registryEntry)}` };
    return { file, entry };
  });
}

export const SUBMISSION_SHAPE =
  "a submission has exactly three fields: repository (https://github.com/<owner>/<repo>), folder (the folder holding " +
  "rig.yaml, or . for the repository root) and ref (a branch, tag or commit)";

/**
 * `registry/submissions/*.yaml` as `{ file, submission?, problem? }`, sorted by file name. A submission is a request
 * for listing, never a listing: loadRegistry, the status generator and the site read only `registry/*.yaml`.
 */
export function loadSubmissions(root, validators) {
  const dir = path.join(root, "registry", "submissions");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name !== "README.md").sort().map((name) => {
    // Names are echoed into CI output (and a notice), so only plain names are read; any other is quoted.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.ya?ml$/.test(name)) {
      return { file: `registry/submissions/${JSON.stringify(name)}`, problem: `name the file <your-team>.yaml (letters, digits, ".", "_", "-"); ${SUBMISSION_SHAPE}` };
    }
    const file = `registry/submissions/${name}`;
    let submission;
    try {
      submission = readYaml(path.join(dir, name));
    } catch (error) {
      return { file, problem: `not readable YAML: ${error.message}` };
    }
    if (!validators.submission(submission)) return { file, problem: `${SUBMISSION_SHAPE} (${schemaError(validators.submission)})` };
    return { file, submission };
  });
}

/** `status/journeys/<id>-v<version>.json` as a Map "id@version" -> journey, plus problems. */
export function loadJourneys(root, validators) {
  const dir = path.join(root, "status", "journeys");
  const journeys = new Map();
  const problems = [];
  if (!fs.existsSync(dir)) return { journeys, problems };
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const file = `status/journeys/${name}`;
    let journey;
    try {
      journey = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    } catch (error) {
      problems.push(`${file}: not readable JSON: ${error.message}`);
      continue;
    }
    if (!validators.journey(journey)) {
      problems.push(`${file}: not a journey v1: ${schemaError(validators.journey)}`);
      continue;
    }
    if (name !== `${journey.id}-v${journey.version}.json`) problems.push(`${file}: name must be ${journey.id}-v${journey.version}.json`);
    const steps = journey.requiredSteps.map((s) => s.id);
    if (new Set(steps).size !== steps.length) problems.push(`${file}: a required step id appears twice`);
    journeys.set(`${journey.id}@${journey.version}`, journey);
  }
  return { journeys, problems };
}

/**
 * Run records under each root: every `run-records/<slug>/*.json` (team records for that listing) and
 * `run-records/_harness/*.json` (harness checks). A record's receipt ref is relative to the run folder,
 * the parent of `run-records/`; it must exist there with the recorded sha256.
 */
export function loadRecords(roots, validators) {
  const teamFiles = new Map();
  const harnessFiles = [];
  const warnings = [];
  for (const root of roots) {
    for (const recordsDir of findRecordFolders(root)) {
      const runDir = path.dirname(recordsDir);
      for (const group of fs.readdirSync(recordsDir, { withFileTypes: true })) {
        const groupDir = path.join(recordsDir, group.name);
        if (!group.isDirectory()) continue;
        if (group.name !== HARNESS_FOLDER && !SLUG.test(group.name)) {
          warnings.push(`${path.relative(root, groupDir)}: not a listing slug or ${HARNESS_FOLDER}; its records were not read`);
          continue;
        }
        for (const name of fs.readdirSync(groupDir).filter((n) => n.endsWith(".json")).sort()) {
          const loaded = loadRecord(path.join(groupDir, name), runDir, validators);
          loaded.file = path.relative(root, path.join(groupDir, name));
          if (group.name === HARNESS_FOLDER) harnessFiles.push(loaded);
          else teamFiles.set(group.name, [...(teamFiles.get(group.name) ?? []), loaded]);
        }
      }
    }
  }
  return { teamFiles, harnessFiles, warnings };
}

function loadRecord(file, runDir, validators) {
  let record;
  try {
    record = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { problem: `not readable JSON: ${error.message}`, receiptVerified: false };
  }
  if (!validators.runRecord(record)) {
    return { problem: `not a run record v1: ${schemaError(validators.runRecord)}`, receiptVerified: false };
  }
  return { record, receiptVerified: receiptMatches(runDir, record.evidence.receipt) };
}

function receiptMatches(runDir, receipt) {
  const target = path.resolve(runDir, receipt.ref);
  if (path.isAbsolute(receipt.ref) || !target.startsWith(runDir + path.sep)) return false;
  try {
    return sha256Hex(fs.readFileSync(target)) === receipt.sha256;
  } catch {
    return false;
  }
}

function findRecordFolders(root) {
  const found = [];
  const walk = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!item.isDirectory() || item.name === "node_modules" || item.name === ".git") continue;
      const full = path.join(dir, item.name);
      if (item.name === "run-records") found.push(full);
      else walk(full);
    }
  };
  walk(root);
  return found.sort();
}
