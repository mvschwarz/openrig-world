// Classes of private detail that must never reach a public status file. The generator builds its output
// from an allowlist of fields, so these are a second line: they catch private text inside an allowed
// free-text field such as a public note.
export const PRIVATE_PATTERNS = [
  // Any token that starts like a path: one or more "/" and a non-space character, "~/", or a drive letter with ":\" or
  // ":/", whatever follows (spaces inside quotes, Unicode). It starts a token unless the character before it is
  // a letter, digit or one of _ / : . ~ - (Unicode letters and digits included), so "and/or", "1/2",
  // "résumé/données" and https://github.com/... pass, while **bold**, 2>/redirects, |pipes and typographic
  // quotes don't hide a path. Known limits: "path:/x" and "file:///x" pass, because ":" is what lets "https:" pass.
  { kind: "absolute path", re: /(^|[^\p{L}\p{N}_\/:.~-])(\/+[^\s\/]|~\/|[A-Za-z]:[\\/])/u },
  { kind: "account, session or email address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*/ },
  { kind: "queue row id", re: /\bqitem-/i },
  { kind: "private host name", re: /\b[a-z0-9-]+\.(local|lan|internal|localdomain|home\.arpa)\b/i },
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

/** Every string (keys included) that isn't well-formed Unicode, which RFC 8785 canonical JSON can't carry. */
export function findIllFormedText(value, at = "$") {
  if (typeof value === "string") return value.isWellFormed() ? [] : [at];
  if (Array.isArray(value)) return value.flatMap((item, i) => findIllFormedText(item, `${at}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [...findIllFormedText(key, `${at}{key}`), ...findIllFormedText(item, `${at}.${key}`)]);
  }
  return [];
}
