import { createHash } from "node:crypto";

/**
 * JSON with object keys sorted by UTF-16 code unit at every depth and no whitespace. For the data these files
 * hold (strings, integers, objects, arrays) this is RFC 8785 (JCS) byte for byte.
 */
export function canonicalJson(value) {
  // Built as a string: a rebuilt object would move integer-like keys (a slug such as "42") back to the front.
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The committed form of a generated file: sorted keys, two-space indent, trailing newline. */
export function canonicalFile(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

/** The status file's self-digest: canonical JSON of everything except `bodyDigest`. */
export function statusBodyDigest(status) {
  const { bodyDigest: _ignored, ...body } = status;
  return sha256Hex(canonicalJson(body));
}
