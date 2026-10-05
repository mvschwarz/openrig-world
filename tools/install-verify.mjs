#!/usr/bin/env node
// Checks, after an install, that each seat has what the bundle declares, in the place its runtime reads it.
// A report, not a gate: it reads files only, never runs a seat, and always exits 0.
//
//   node tools/install-verify.mjs --bundle <rig folder> --cwd <installed working directory>
//     [--preset <name> | --seat pod.member=runtime ...] [--home <user home>] [--openrig-home <dir>]
//     [--json | --declared <pod.member>]
//
// Item names and statuses match the seat-side check (each seat's own native listing), so the two halves line up:
// "startup files: <path>", "culture file", "skills: <name>", "plugins: <id>", "mcp servers: <name>",
// "managed block target". `--declared <seat>` prints that seat's {skills, plugins, mcp_servers} for its --declared.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readYaml } from "./lib/load.mjs";

// Locations follow OpenRig's runtime adapters (packages/daemon/src/adapters/claude-code-adapter.ts and
// codex-runtime-adapter.ts) and the skill folders each harness reads.
const RUNTIMES = {
  "claude-code": {
    skillRoot: ".claude/skills", pluginCopy: ".claude/plugins",
    managedFile: (rig) => rig.managed_blocks?.["claude-code"] ?? "CLAUDE.md",
  },
  codex: {
    skillRoot: ".agents/skills", pluginCopy: ".codex/plugins",
    managedFile: () => "AGENTS.md",
  },
};
const CULTURE_FLOOR = "CULTURE-default.md";
const RELAY = ".openrig/hooks/scripts/activity-relay.cjs";
const CLAUDE_SETTINGS = ".claude/settings.local.json";

/** The delivery a startup file gets: OpenRig's resolveConcreteHint for "auto". */
export function deliveryOf(file, content) {
  const hint = file.delivery_hint ?? "auto";
  if (hint !== "auto") return hint;
  if (file.path.endsWith("SKILL.md") || (content ?? "").startsWith("# SKILL")) return "skill_install";
  return file.path.endsWith(".md") ? "guidance_merge" : "send_text";
}

/** Seats as declared, with a preset or per-seat runtime applied through configurations.yaml. */
export function resolveSeats(bundleDir, { preset, seatRuntimes = {} } = {}) {
  const rig = readYaml(path.join(bundleDir, "rig.yaml"));
  const configFile = path.join(bundleDir, "configurations.yaml");
  const configs = fs.existsSync(configFile) ? readYaml(configFile) : null;
  const chosen = { ...(preset && configs?.presets?.[preset] ? configs.presets[preset] : {}), ...seatRuntimes };
  const seats = [];
  for (const pod of rig.pods ?? []) {
    for (const member of pod.members ?? []) {
      const seat = `${pod.id}.${member.id}`;
      const agent = loadAgent(bundleDir, member.agent_ref);
      let runtime = member.runtime;
      let profileName = member.profile ?? "default";
      if (chosen[seat]) {
        runtime = chosen[seat];
        profileName = configs?.seats?.[seat]?.runtimes?.[runtime] ?? profileName;
      }
      const profile = agent?.spec.profiles?.[profileName];
      runtime ??= profile?.preferences?.runtime ?? agent?.spec.defaults?.runtime ?? "claude-code";
      seats.push({ seat, pod, member, runtime, profileName, profile, agent });
    }
  }
  return { rig, seats };
}

function loadAgent(bundleDir, ref) {
  if (typeof ref !== "string" || !ref.startsWith("local:")) return null;
  const dir = path.resolve(bundleDir, ref.slice("local:".length));
  const file = path.join(dir, "agent.yaml");
  return fs.existsSync(file) ? { dir, spec: readYaml(file) } : null;
}

const read = (file) => { try { return fs.readFileSync(file, "utf8"); } catch { return null; } };
const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const isDir = (file) => { try { return fs.statSync(file).isDirectory(); } catch { return false; } };
const readJson = (file) => { const t = read(file); if (t === null) return { missing: true }; try { return { value: JSON.parse(t) }; } catch { return { bad: true }; } };
const hasBlock = (text, id) => text.includes(`<!-- BEGIN OpenRig MANAGED BLOCK: ${id} -->`)
  || text.includes(`<!-- BEGIN RIGGED MANAGED BLOCK: ${id} -->`);

/**
 * One entry per seat: { seat, runtime, profile, declared: { skills, plugins, mcp_servers }, items }, where each item is
 * { item, status: present|missing|unknown, where, detail }.
 */
export function verifyInstall({ bundleDir, cwd, home, openrigHome, preset, seatRuntimes }) {
  const { rig, seats } = resolveSeats(bundleDir, { preset, seatRuntimes });
  return seats.map((s) => checkSeat(rig, s, { bundleDir, cwd, home, openrigHome }));
}

function checkSeat(rig, s, { bundleDir, cwd, home, openrigHome }) {
  const items = [];
  const declared = { skills: [], plugins: [], mcp_servers: [] };
  const add = (item, status, where, detail) => items.push({ item, status, where: where ?? null, detail: detail ?? null });
  const result = { seat: s.seat, runtime: s.runtime, profile: s.profileName, declared, items };
  const loc = RUNTIMES[s.runtime];
  if (!loc) { add("seat", "unknown", null, `no location check for runtime ${s.runtime}`); return result; }
  if (s.agent === null) add("agent", "unknown", null, `${s.member.agent_ref} is not a local agent in this bundle`);
  const seatCwd = path.resolve(cwd, s.member.cwd ?? ".");

  // Managed block target, then the blocks OpenRig merges into it.
  const managedName = loc.managedFile(rig);
  const managed = read(path.join(seatCwd, managedName));
  add("managed block target", managed === null ? "missing" : "present", managedName, managed === null ? "file does not exist" : null);
  const block = (item, id) => {
    if (managed === null) add(item, "missing", managedName, `${managedName} does not exist`);
    else add(item, hasBlock(managed, id) ? "present" : "missing", managedName, hasBlock(managed, id) ? `block ${id}` : `no block ${id}`);
  };
  block("culture file (OpenRig default)", CULTURE_FLOOR);

  // Culture and startup files in OpenRig's layer order (agent, profile, culture, rig, pod, member).
  const root = s.agent?.dir ?? bundleDir;
  const files = [
    ...(s.agent?.spec.startup?.files ?? []).map((f) => ({ ...f, root })),
    ...(s.profile?.startup?.files ?? []).map((f) => ({ ...f, root })),
    ...(rig.culture_file ? [{ path: rig.culture_file, root: bundleDir, culture: true }] : []),
    ...(rig.startup?.files ?? []).map((f) => ({ ...f, root: bundleDir })),
    ...(s.pod.startup?.files ?? []).map((f) => ({ ...f, root: bundleDir })),
    ...(s.member.startup?.files ?? []).map((f) => ({ ...f, root: bundleDir })),
  ].filter((f) => !f.applies_on || f.applies_on.includes("fresh_start"));
  for (const file of files) {
    const item = file.culture ? "culture file" : `startup files: ${file.path}`;
    const delivery = deliveryOf(file, read(path.join(file.root, file.path)));
    if (delivery === "guidance_merge") block(item, file.path);
    else if (delivery === "skill_install") {
      const target = path.join(loc.skillRoot, path.basename(path.dirname(file.path)), path.basename(file.path));
      add(item, isFile(path.join(seatCwd, target)) ? "present" : "missing", target, null);
    } else add(item, "unknown", null, "typed into the session at launch; no file to check (the seat's own session shows it)");
  }

  // Skills: in a folder the runtime reads (the project's, or the user's with --home).
  const skill = (name, from, copyNote) => {
    declared.skills.push(name);
    const project = path.join(loc.skillRoot, name, "SKILL.md");
    if (isFile(path.join(seatCwd, project))) return add(`skills: ${name}`, "present", project, from ?? null);
    if (home && isFile(path.join(home, loc.skillRoot, name, "SKILL.md"))) return add(`skills: ${name}`, "present", `~/${project}`, from ?? null);
    add(`skills: ${name}`, "missing", path.join(loc.skillRoot, name),
      [`not in a skill folder ${s.runtime} reads (${home ? "project or user" : "project; pass --home for the user's"})`, from, copyNote].filter(Boolean).join("; "));
  };
  for (const id of s.profile?.uses?.skills ?? []) skill(id);

  // Plugins: OpenRig's projected copy, and each of the plugin's skills where the runtime reads skills.
  const pluginDecls = s.agent?.spec.resources?.plugins ?? [];
  for (const id of s.profile?.uses?.plugins ?? []) {
    declared.plugins.push(id);
    const copy = path.join(loc.pluginCopy, id);
    const copied = isDir(path.join(seatCwd, copy));
    add(`plugins: ${id}`, copied ? "present" : "missing", copy, copied ? "OpenRig's projected copy" : "no projected copy");
    const source = pluginDecls.find((p) => p.id === id)?.source?.path;
    const fromHome = typeof source === "string" && source.startsWith("openrig-home:") && openrigHome
      ? path.join(openrigHome, source.slice("openrig-home:".length)) : null;
    const skillsDir = copied ? path.join(seatCwd, copy, "skills") : fromHome ? path.join(fromHome, "skills") : null;
    if (!skillsDir || !isDir(skillsDir)) {
      add(`plugins: ${id} skills`, "unknown", null, "the plugin's skills can't be listed here (no projected copy; pass --openrig-home to read its source)");
      continue;
    }
    for (const name of fs.readdirSync(skillsDir).sort()) {
      if (isFile(path.join(skillsDir, name, "SKILL.md"))) skill(name, `from plugin ${id}`, copied ? `its copy under ${copy} is not a skill folder` : null);
    }
  }

  // Runtime resources the profile selects for this runtime.
  const resources = s.agent?.spec.resources?.runtime_resources ?? [];
  for (const id of s.profile?.uses?.runtime_resources ?? []) {
    const res = resources.find((r) => r.id === id);
    if (!res) { add(`resource: ${id}`, "unknown", null, "not declared in the agent's resources"); continue; }
    if (res.runtime && res.runtime !== s.runtime) continue; // declared for another runtime only
    checkResource(res, seatCwd, s.agent.dir, add, declared);
  }
  return result;
}

function checkResource(res, seatCwd, agentDir, add, declared) {
  const item = `resource: ${res.id}`;
  if (res.type === "claude_activity_hooks") {
    if (!isFile(path.join(seatCwd, RELAY))) return add(item, "missing", RELAY, "the activity relay script is not in the seat's folder");
    const s = readJson(path.join(seatCwd, CLAUDE_SETTINGS));
    if (s.missing) return add(item, "missing", CLAUDE_SETTINGS, "settings file does not exist");
    if (s.bad) return add(item, "unknown", CLAUDE_SETTINGS, "settings file is not valid JSON");
    const commands = Object.values(s.value.hooks ?? {}).flat().flatMap((g) => g?.hooks ?? []).map((h) => String(h?.command ?? ""));
    return commands.some((c) => c.includes(RELAY))
      ? add(item, "present", CLAUDE_SETTINGS, "hooks run the activity relay")
      : add(item, "missing", CLAUDE_SETTINGS, "no hook runs the activity relay");
  }
  if (res.type === "claude_settings_fragment" || res.type === "claude_mcp_fragment") {
    const mcp = res.type === "claude_mcp_fragment";
    const target = mcp ? ".mcp.json" : CLAUDE_SETTINGS;
    const frag = readJson(path.join(agentDir, res.path)).value;
    if (!frag || typeof frag !== "object") return add(item, "unknown", target, "the declared fragment can't be read from the bundle");
    const t = readJson(path.join(seatCwd, target));
    const have = t.value ? (mcp ? t.value.mcpServers ?? {} : t.value) : {};
    for (const key of Object.keys(mcp ? frag.mcpServers ?? {} : frag)) {
      const name = mcp ? `mcp servers: ${key}` : `${item} ${key}`;
      if (mcp) declared.mcp_servers.push(key);
      if (t.missing) add(name, "missing", target, "file does not exist");
      else if (t.bad) add(name, "unknown", target, "file is not valid JSON");
      else add(name, key in have ? "present" : "missing", target, null);
    }
    return;
  }
  add(item, "unknown", null, `no location check for resource type ${res.type}`);
}

export function formatSeats(seats) {
  const lines = [];
  for (const s of seats) {
    lines.push(`${s.seat} (${s.runtime}, profile ${s.profile})`);
    for (const i of s.items) lines.push(`  ${i.item}: ${i.status}${i.where ? ` [${i.where}]` : ""}${i.detail ? ` — ${i.detail}` : ""}`);
  }
  return lines;
}

function parseArgs(argv) {
  const opts = { seatRuntimes: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => argv[++i];
    if (a === "--bundle") opts.bundleDir = value();
    else if (a === "--cwd") opts.cwd = value();
    else if (a === "--home") opts.home = value();
    else if (a === "--openrig-home") opts.openrigHome = value();
    else if (a === "--preset") opts.preset = value();
    else if (a === "--seat") { const [seat, runtime] = String(value()).split("="); opts.seatRuntimes[seat] = runtime; }
    else if (a === "--json") opts.json = true;
    else if (a === "--declared") opts.declared = value();
    else opts.unknownArg = a;
  }
  return opts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.bundleDir || !opts.cwd || opts.unknownArg) {
    console.error("usage: node tools/install-verify.mjs --bundle <rig folder> --cwd <installed working directory> [--preset <name> | --seat pod.member=runtime] [--home <dir>] [--openrig-home <dir>] [--json | --declared <pod.member>]");
  } else {
    let seats;
    try { seats = verifyInstall(opts); }
    catch (err) { seats = [{ seat: "*", runtime: null, profile: null, declared: { skills: [], plugins: [], mcp_servers: [] }, items: [{ item: "bundle", status: "unknown", where: null, detail: err.message }] }]; }
    if (opts.declared) console.log(JSON.stringify(seats.find((s) => s.seat === opts.declared)?.declared ?? { skills: [], plugins: [], mcp_servers: [] }, null, 2));
    else if (opts.json) console.log(JSON.stringify({ schema: "openrig.install-verify/v1", seats }, null, 2));
    else for (const line of formatSeats(seats)) console.log(line);
  }
}
