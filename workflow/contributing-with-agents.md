# Contributing to OpenRig with agents

This is the whole loop for building OpenRig with the help of coding agents, from installing it to a
merged pull request. Each step points at the document that owns the details. Paths in backticks are
relative to the root of your OpenRig checkout. Read them there: your checkout is the version you are
changing, and it may differ from `main`.

> **This map is not the territory.** Commands and files move. Before relying on a command here,
> run its `--help`. Before relying on a path, open it.

## Install OpenRig

Follow "Install and first run" in the product
[README](https://github.com/mvschwarz/openrig#install-and-first-run). You need Node.js 22 or 24
and tmux, on macOS or Linux. Read
[what OpenRig changes on your machine](https://github.com/mvschwarz/openrig#what-openrig-changes-on-your-machine)
before you launch anything, because launching writes provider hooks and workspace trust settings.

Then install this pack (see this repository's README) so your agents can load it.

## Clone and build

```bash
git clone https://github.com/mvschwarz/openrig.git
cd openrig
npm install
npm run build
```

Two different OpenRigs are now in play, and agents mix them up:

- **The installed one runs your agents.** `rig --version` and `rig daemon status` describe it.
- **The checkout is what you are changing.** `git rev-parse HEAD` describes it.

Restarting the installed daemon does not run your checkout. Stopping it stops every agent running on
it, possibly including the one you are talking to. Test your change with the repository's own
harnesses, which start a private daemon (see "Run the test ladder" below).

For work in a git worktree, read `docs/reference/worktree-builds.md`: each worktree needs its own
`npm install`, not a symlinked `node_modules`.

## Optional: a small contributor rig

One agent in one terminal is enough to contribute. If you want a pair, one agent that builds and
one that checks the result, see the contributor rig in [`rigs/openrig-dev/`](../rigs/openrig-dev/)
and follow its README.

Whatever rig you launch, preview it first with `rig up <spec> --plan`, which shows what would
happen without doing it.

## Load the developing-openrig skill

Start your agent with the checkout as its working directory. Claude Code and Codex find the
repository's `developing-openrig` skill there (`.claude/skills/` and `.agents/skills/`). You can
also ask for it by name: "use the developing-openrig skill."

The skill is a map to the other maps:

| You want to know | Read |
|---|---|
| How the packages fit, and where to add a command, route, migration, adapter, skill, context pack or scenario | `ARCHITECTURE.md` |
| Whether your change touches a high-risk area, what depends on it, and what broke there before | `docs/as-built/arteries.md` |
| What to run before you push, and what each test layer can and cannot prove | `docs/as-built/test-layers.md` |
| How to open a good pull request, and what review looks like | `CONTRIBUTING.md` |
| The exact behaviour of a `rig` command | `rig <command> --help`, then `packages/cli/src/commands/` |

Load this pack alongside it for the project's purpose and craft:
`rig context profile openrig-project-world --situation fresh`.

## Pick work

- **Labelled issues.** Look for `good first issue` and `help wanted`:

  ```bash
  gh issue list -R mvschwarz/openrig --label "good first issue"
  gh issue list -R mvschwarz/openrig --label "help wanted"
  ```

- **Missing test coverage.** "Help wanted: command families without a behavioural scenario" in
  `docs/as-built/test-layers.md` lists `rig` command families with a proposed first check for
  each. Read the two constraints above that list before you start: some rows need a scenario-runner
  binding first, and rows that need a seat to answer need an input-consuming stub that does not
  exist yet.
- **Something you hit yourself.** Open an issue with the bug template first, unless it is a small,
  obvious fix.

Before you build a feature or a behaviour change, open an issue or an *Ideas* Discussion and say
what you are trying to do and what stops you. For an integration with another tool, wait for a
maintainer's yes on scope; an issue on its own is not a yes. `CONTRIBUTING.md` explains why.

## Make the change

1. **Find the owner.** "Where to add things" in `ARCHITECTURE.md` gives a recipe for each kind of
   change. Read the neighbouring example it names before you write anything.
2. **Check the arteries.** If your diff touches anything in `docs/as-built/arteries.md` (message
   delivery, launch and resume, the queue, rig identity, skill projection, process observation,
   migrations, restore), read that row: what depends on it and what broke there before. A file's
   absence from that page does not make a change safe.
3. **Keep it reviewable.** One concern per pull request, small enough to review in one sitting.
   Do not edit `CHANGELOG.md` or bump versions. Match the surrounding style. Commit messages follow
   the log: `fix(cli): …`, `feat(daemon): …`, `docs(reference): …`.
4. **Fix the map when it is wrong.** If a document disagrees with the code, fix the document in the
   same pull request or open an issue.

## Run the test ladder

Every change runs the three documented checks:

```bash
npm run build
npm run lint
npm test
```

Then add the layers your change calls for. `docs/as-built/test-layers.md` has the full ladder;
the ones agents reach for most:

| Layer | Command | Notes |
|---|---|---|
| One test file | `npx vitest run packages/cli/test/<file>.test.ts` | From the repository root |
| Web UI suite | `npm run test:ui` | Only if you touch `packages/ui` or an API it reads; the web UI is in maintenance mode |
| Stub scenarios | `node --import tsx packages/daemon/scripts/run-scenarios.mjs <scenario.yaml>` | Run `npm run build` first. It starts its own daemon and tmux server |
| Portability report | `node scripts/portability-report.mjs` | Lists home paths, addresses or credentials your diff adds |

The scenario runner builds its environment from `HOME`, `PATH` and `TERM` only, so it drops your
session's `TMUX` and daemon variables and never touches the daemon your agent runs on. That makes it
safe to run from an agent that OpenRig launched.

A stub scenario proves OpenRig's own plumbing, not how Claude Code or Codex behave. Say which you
exercised. For what a passing check actually proves, read
[`craft/proving-a-change.md`](../craft/proving-a-change.md).

## Open the pull request

Fill in the template. It asks three things:

- **What a user gets:** the behaviour before and after, in a sentence or two. Link the issue.
- **How you verified it:** the revision you tested, what you actually ran and saw, and the checks
  you could not run.
- **Anything you were unsure about:** design choices, edge cases you did not cover, where a
  reviewer should look hardest. Empty is a fine answer.

If your change touches an artery, also describe its downstream effect, and either link the scenario
that covers it, add one, or say exactly why the stub cannot exercise it and what you ran instead.

Your agent can draft the description. Read it before you submit it: you are the one vouching for
it. Redact credentials, private paths and personal details from logs and screenshots.

## Review: people and agents

- Reviews are done by people and by the project's own agents. An agent may ask the first
  clarifying question or run the reproduction. **A maintainer makes the merge decision.**
- The project aims to acknowledge a pull request within a day and to reach a first substantive
  review decision within seven days. These are targets, not guarantees; `CONTRIBUTING.md` has the
  current wording.
- CI runs on every pull request to `main`: build and packaging, typecheck, repository checks,
  package tests on macOS with outbound network blocked, and a containerised installed-package
  scenario. A separate portability report lists machine-specific values in your diff and never
  fails.
- At an artery, review looks at the effect, not only the diff. Away from the arteries, small pull
  requests get a normal review.

If you are the reviewer, human or agent, ask:

1. Does the description say what a user gets, and does the diff deliver that?
2. Does the verification exercise the change where two parts meet, or only each part alone?
3. If it touches an artery: is there a scenario, or a precise reason there is none?
4. Has any check that is claimed to catch a regression been seen to fail on the old behaviour?
5. Is a stub result being presented as proof of real Claude Code or Codex behaviour?
6. If it adds a refusal, a prompt or a required step: does it name who is harmed, how, and what it
   costs everyone else?

Write findings the author can act on: what you saw, where, and what would settle it.

## After a context reset

After a compaction, a `/clear` or a restart, your summary of the work is testimony, not evidence.
Re-derive before you continue:

```bash
git rev-parse --show-toplevel
git branch --show-current
git log --oneline -1
git status --short
rig --version
```

Then re-open the issue or pull request you were working on (`gh pr view` shows the one for the
current branch), and re-run the last failing test instead of trusting what the summary says about
it. If your agent runs inside a rig, `rig whoami --json` tells it which seat it occupies.
