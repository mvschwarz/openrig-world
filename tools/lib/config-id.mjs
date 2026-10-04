// Configuration ID (bundle-formats.md): every member's `pod.member=runtime`, sorted by `pod.member` in plain
// code-unit order, joined with "," and no whitespace. Preset names are aliases beside the ID, never inside it.
const PAIR = /^([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)=([a-z0-9][a-z0-9-]*)$/;

/** Returns null when `id` is canonical, otherwise a reason. */
export function configurationIdProblem(id) {
  if (typeof id !== "string" || id.length === 0) return "empty configuration ID";
  const keys = [];
  for (const pair of id.split(",")) {
    const match = PAIR.exec(pair);
    if (!match) return `"${pair}" is not pod.member=runtime`;
    keys.push(match[1]);
  }
  for (let i = 1; i < keys.length; i++) {
    if (keys[i - 1] === keys[i]) return `member ${keys[i]} appears twice`;
    if (keys[i - 1] > keys[i]) return `members are not sorted (${keys[i - 1]} before ${keys[i]})`;
  }
  return null;
}
