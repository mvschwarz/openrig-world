# OpenRig project world

A context pack that helps a coding agent work on [OpenRig](https://github.com/mvschwarz/openrig)
itself. It covers what the project is for, how a contribution gets from an idea to a merged pull
request, and how to prove that a change works. Install it once. After that, any agent working in
an OpenRig checkout can load it with one command.

> **This map is not the territory.** It is short on purpose, it is incomplete, and it will drift.
> The OpenRig source, the `rig` binary you are running, and the maps inside the product repository
> are the authorities. Where this pack disagrees with them, they are right. Please open an issue
> or a pull request here when you find a disagreement.

## Who it is for

- People who want to contribute to OpenRig, and the coding agents they work with.
- Claude Code and Codex are supported directly: `rig context profile` composes a walk for either.
  Agents on other runtimes can still read every file with `rig context get`, or straight from this
  repository, because the files are plain Markdown.

You do not need a multi-agent rig to use this pack. One agent in one terminal is enough.

## How it fits with the rest of OpenRig's context

OpenRig gives agents context in layers. This pack is one of them.

| Layer | What it answers | Where it comes from |
|---|---|---|
| System World | How to be an agent inside OpenRig: identity, peers, the queue, the command surface | Ships with OpenRig. On a default install it selects the `world-public` and `onboarding-width` packs; `rig context list` shows what your install has. |
| **Project world (this pack)** | How to build OpenRig: its purpose, how contributions move, how to prove a change | This repository |
| Code maps and the `developing-openrig` skill | Where code lives, what is risky, what to run | The product repository: `ARCHITECTURE.md`, `docs/as-built/arteries.md`, `docs/as-built/test-layers.md`, `.claude/skills/` and `.agents/skills/` |
| Your work | The issue or pull request in front of you | GitHub |

This pack points at the product repository's maps instead of copying them. A copy would drift, and
the maps in your checkout describe the code you are actually changing.

## Install

You need OpenRig installed, with its daemon running. The
[product README](https://github.com/mvschwarz/openrig#install-and-first-run) covers requirements
and [what OpenRig changes on your machine](https://github.com/mvschwarz/openrig#what-openrig-changes-on-your-machine).

```bash
rig context add --git https://github.com/mvschwarz/openrig-world.git
rig context list
```

`--git` clones this repository using your existing Git setup, finds `manifest.yaml` at its root,
and installs the pack under the manifest's name, `openrig-world`. Only the files the
manifest declares are served to agents; this README is for you.

To check for and take later changes:

```bash
rig context source inspect openrig-world
rig context source update openrig-world
```

## Load it

Run one of these yourself, or ask your agent to run it. Each prints the composed text for the agent
to read.

| When | Command |
|---|---|
| Starting work on OpenRig | `rig context profile openrig-world --situation fresh` |
| Reviewing a pull request | `rig context profile openrig-world --situation fresh --profile reviewer` |
| After a compaction, `/clear` or restart | `rig context profile openrig-world --situation post-compaction` |
| One file | `rig context get openrig-world/craft/proving-a-change.md` |
| One section | `rig context get 'openrig-world/workflow/contributing-with-agents.md#after-a-context-reset'` |
| Everything, in one bundle | `rig context get openrig-world` |

`rig context profile` composes for Claude Code by default. Add `--runtime codex` for Codex, or set
`OPENRIG_RUNTIME`. Add `--json` to see token estimates and content hashes for each piece.

## What is inside

| File | What it covers |
|---|---|
| `identity/what-openrig-is-for.md` | What OpenRig is for, and how proposed changes are judged |
| `workflow/contributing-with-agents.md` | The loop from install to merged pull request, done with agents |
| `craft/proving-a-change.md` | How to show a change works: seams, checks that can fail, proof by effect |
| `craft/tells-of-a-wrong-claim.md` | Moments when you are about to be wrong, and the cheapest check for each |
| `manifest.yaml` | The pack manifest: files, atoms, and the `reviewer` profile |

## Rig catalog

Reviewed listings, submissions, team diagrams and public status live in
[openrig-registry](https://github.com/mvschwarz/openrig-registry). The workshop and factory-rsi
bundle sources remain here under `rigs/`; their installation links do not change.

`registry/workshop.yaml` is the only catalog file retained here, for OpenRig 0.6.6 operators.
The copy in openrig-registry is canonical. Update this compatibility mirror with the exact same
bytes in a paired, reviewed pull request when that pin changes, and merge both before announcing
the new pin. See the [registry's compatibility instructions](https://github.com/mvschwarz/openrig-registry#workshop-compatibility-with-openrig-066).

## Contributing to this pack

Pull requests are welcome, especially when you find something here that is stale or wrong. Keep
pages short, point at sources instead of copying them, and describe commands only after you have
run them.

If you change `manifest.yaml` or a section heading that an atom addresses, commit, then check that
your clone still loads under a scratch name:

```bash
rig context add --git /path/to/your/clone --name openrig-world-test
rig context profile openrig-world-test --situation fresh --json
rig context profile openrig-world-test --situation post-compaction --json
rig context profile openrig-world-test --situation fresh --profile reviewer --json
rig context rm openrig-world-test
```

Each `profile` command should list its pieces with no error.

## License

Apache-2.0, the same as the OpenRig product repository. See [LICENSE](LICENSE).
