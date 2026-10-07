# OpenRig bundle tools

These tools stay with the OpenRig-authored bundles in this repository. Registry and status generation live in
[openrig-registry/tools](https://github.com/mvschwarz/openrig-registry/tree/main/tools).

```sh
cd tools && npm ci --ignore-scripts --no-audit --no-fund
node --test test/*.test.mjs
node install-verify.mjs --bundle ../rigs/workshop --cwd <installed working directory> [--preset <name>] [--home <dir>] [--json]
```

## Install check (`install-verify.mjs`)

Like a spec check, but after the install. Given a bundle folder and the installed rig's working directory, it reads
what each seat is declared to get and looks for it where that seat's runtime reads it:

- **The managed block target and its blocks:** OpenRig's default culture, the rig's culture file, and Markdown startup
  files, in `CLAUDE.md` (or the rig's `managed_blocks` file) for Claude Code and in `AGENTS.md` for Codex.
- **Skills,** including each skill in a selected plugin: `.claude/skills/<name>` or `.agents/skills/<name>`, in the
  project or, with `--home`, the user's home. Without `--home`, a skill not in the project's folder is `unknown`.
  A plugin's projected copy (`.claude/plugins/<id>`, `.codex/plugins/<id>`) is reported, but it isn't a skill folder.
- **MCP servers and runtime resources** (activity hooks, settings fragments).
- **Startup files typed in at launch** are `unknown` here. The seat's own session shows them.

Each line is `present`, `missing` or `unknown` with the reason. It exits 0 always: it's a report, not a gate. `--json`
gives the same data, and `--declared <pod.member>` prints one seat's `{skills, plugins, mcp_servers}` for the seat-side
check, which uses the same item names. Locations follow OpenRig's runtime adapters. Pi seats are `unknown` for now.
