// Writes an installed-rig layout for the install-verify fixture bundle into `dir`: some declared items present,
// some missing, so one report shows both. Used by the test; nothing here runs a seat.
import fs from "node:fs";
import path from "node:path";

const block = (id, body) => `<!-- BEGIN OpenRig MANAGED BLOCK: ${id} -->\n${body}\n<!-- END OpenRig MANAGED BLOCK: ${id} -->\n`;
const skill = (name) => `---\nname: ${name}\ndescription: Use when ${name}.\n---\n# ${name}\n`;

export function makeInstalled(dir) {
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const cwd = path.join(dir, "project");
  const home = path.join(dir, "home");
  // Claude seat: blocks, its own skill, the plugin copy (not a skill folder), hooks and one of two MCP servers.
  write("project/CLAUDE.local.md", block("CULTURE-default.md", "floor") + block("CULTURE.md", "culture") + block("startup/rules.md", "rules"));
  write("project/.claude/skills/notes/SKILL.md", skill("notes"));
  write("project/.claude/plugins/kit/skills/handoff/SKILL.md", skill("handoff"));
  write("project/.claude/plugins/kit/skills/map/SKILL.md", skill("map"));
  write("project/.openrig/hooks/scripts/activity-relay.cjs", "// relay\n");
  write("project/.claude/settings.local.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "node '/x/project/.openrig/hooks/scripts/activity-relay.cjs'" }] }] } }));
  write("project/.mcp.json", JSON.stringify({ mcpServers: { docs: { command: "docs-server" } } }));
  // Codex seat: AGENTS.md without the rules block, no project copy of its own skill, one plugin skill in .agents/skills.
  write("project/AGENTS.md", block("CULTURE-default.md", "floor") + block("CULTURE.md", "culture"));
  write("project/.codex/plugins/kit/skills/handoff/SKILL.md", skill("handoff"));
  write("project/.codex/plugins/kit/skills/map/SKILL.md", skill("map"));
  write("project/.agents/skills/handoff/SKILL.md", skill("handoff"));
  // The user's own skill folder holds the Codex seat's map skill.
  write("home/.agents/skills/map/SKILL.md", skill("map"));
  return { cwd, home };
}
