// Classes of private detail that must never reach a public status file. The generator builds its output
// from an allowlist of fields, so these are a second line: they catch private text inside an allowed
// free-text field such as a public note.
export const PRIVATE_PATTERNS = [
  { kind: "absolute path", re: /(^|[\s"'(=])(\/(Users|home|private|tmp|var|etc|opt|root|srv|mnt)\/|~\/|[A-Za-z]:\\)/ },
  { kind: "account, session or email address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*/ },
  { kind: "queue row id", re: /\bqitem-/i },
  { kind: "IP address or localhost", re: /\b(\d{1,3}(\.\d{1,3}){3}|localhost)\b/i },
  { kind: "non-GitHub URL", re: /\bhttps?:\/\/(?!github\.com\/)/i },
];

/** Every string in `value` that matches a private class, as `{ at, kind }` with a JSON-path-like location. */
export function findPrivateText(value, at = "$") {
  const found = [];
  if (typeof value === "string") {
    for (const { kind, re } of PRIVATE_PATTERNS) if (re.test(value)) found.push({ at, kind });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => found.push(...findPrivateText(item, `${at}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      found.push(...findPrivateText(key, `${at}{key}`));
      found.push(...findPrivateText(item, `${at}.${key}`));
    }
  }
  return found;
}
