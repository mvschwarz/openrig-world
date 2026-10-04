# openrig-dev

A four-seat OpenRig team for working on OpenRig itself. You launch it from your
clone of the openrig repository, give the lead an issue, and the team turns it
into one pull request with an honest description. You decide when it is pushed.
Every seat runs with permission prompts off; "Permissions" below says what that
means and how to turn them back on.

| Seat | Runtime | Does |
|---|---|---|
| `build-lead@openrig-dev` | Claude Code | Scopes the issue into one pull-request-sized outcome, hands it on, owns the PR description. Talk to this seat. |
| `build-impl@openrig-dev` | Claude Code | Makes the change on its own branch and worktree, runs build, lint and tests. |
| `check-review@openrig-dev` | Codex | Reviews the handed-off commit against ARCHITECTURE.md, arteries.md and the code; runs the tests that bear on it. |
| `check-qa@openrig-dev` | Codex | Runs the test layers the change calls for, including stub-agent scenarios, and reports what each one proved. |

Every seat works in your clone and loads the repository's own
`developing-openrig` skill (`.claude/skills/` and `.agents/skills/`), which
points at ARCHITECTURE.md, docs/as-built/arteries.md and
docs/as-built/test-layers.md. `CULTURE.md` holds the team's values.

## Before you start

- A GitHub account that can fork repositories and open pull requests, with push credentials configured on this machine.
- OpenRig 0.6.5 or later (`rig --version`), Node 22 or 24, and tmux. This spec
  uses `openrig-home:` plugin paths to select the plugin seeded under the
  daemon's configured home, including a non-default `OPENRIG_HOME`.
- Claude Code and Codex installed and logged in.
- A clone of the openrig repository, set up as CONTRIBUTING.md describes
  (`npm install`, `npm run build`).
- A clone of this repository, anywhere on disk.

Keep OpenRig's instruction files out of your pull requests. OpenRig writes them
into your clone, and the openrig repository does not ignore them. From your
openrig clone:

```sh
printf '%s\n' CLAUDE.local.md AGENTS.md .codex/ gate-lane-verdict.json >> .git/info/exclude
```

This file is local to your clone and is never committed. It applies to the
worktrees the seats create, too. If you skip this step, the lead adds any
missing entries when it starts.

Optional: if this repository's context pack is not installed yet, add it so the
seats can load it at start (`rig context add --help` has the options):

```sh
rig context add --git <path-or-URL-of-your-openrig-world-clone>
```

## Run it

From the root of your openrig clone, preview, then launch:

```sh
rig up <path-to>/openrig-world/rigs/openrig-dev/rig.yaml --cwd . --plan
rig up <path-to>/openrig-world/rigs/openrig-dev/rig.yaml --cwd .
```

`--cwd .` matters. Member working directories in a rig spec resolve against the
spec's own folder, so without it the seats would start in this repository
instead of your clone. Each seat checks for this at start and stops if it is in
the wrong place.

Then give the lead some work. Open the TUI with `rig` and open the lead's
terminal, or send from any shell. A message from your own terminal arrives
marked as from an unsigned sender, because it doesn't come from a seat. That's
expected; start it with your name if you want the lead to know who sent it:

```sh
rig send build-lead@openrig-dev "Please take issue #<number>: <one line on what you want>"
```

Stop the team with `rig down openrig-dev`. That removes OpenRig's blocks from
`CLAUDE.local.md` and `AGENTS.md`. The seats' git worktrees under `.worktrees/`
stay; remove them with `git worktree remove` when you are done.

## Permissions

Every seat starts with permission prompts off. `rig.yaml` sets
`permission_policy: builtin:yolo`, so OpenRig launches:

- **Claude Code seats** with `--dangerously-skip-permissions`: no permission
  prompts, for file edits or for commands.
- **Codex seats** with full access (`-s danger-full-access -a never`): no
  sandbox and no approval prompts, so they can use the network, including the
  local OpenRig daemon.
- **A seat on Pi,** if a configuration puts one there, with Pi's full resource
  trust (`--approve`).

**Before your first install, accept Claude Code's bypass warning once.** In
your openrig clone, run `claude --dangerously-skip-permissions`, accept its
prompts (including "Yes, I accept" on the bypass warning), then type `/exit`.
Claude Code remembers your answer on this machine, so the seats start without
stopping. If a Claude seat does stop at the warning, accept it there, then run
`rig down openrig-dev` and `rig up openrig-dev --existing --fresh build.lead build.impl`
(name each seat that stalled) so it gets its start steps. That command reports
`partially_restored` and exits 1, which is expected.

**Or let OpenRig accept the warnings for you (OpenRig 0.6.6 or later).** Add
`--non-interruptive` to your `rig up` or `rig bundle install` command, for
example:

```sh
rig up <path-to>/openrig-world/rigs/openrig-dev/rig.yaml --cwd . --non-interruptive
```

OpenRig then accepts Claude Code's bypass-permissions warning with a launch flag
and hides Codex's full-access and GPT-5.1 migration notices, so the seats start
without stopping. It writes nothing to your Claude or Codex settings. The choice
is saved on the rig, so later launches keep it; to turn it off, run
`rig up openrig-dev --existing --no-non-interruptive`. Sign-in stays yours, and a
notice that a newer harness version adds can still stop a seat (Codex's
GPT-5.1-Codex-Max notice is one today). docs/reference/non-interruptive-mode.md
in the openrig repository has the details.

**Install and run the rig as your normal user, not root.** Claude Code refuses
to bypass permissions when it runs as root or under `sudo`.

The team works without stopping to ask, and each seat can run any command on
this machine as you: change or delete files you can reach, install packages and
use the network. Install it where you are comfortable with that.

**The rig still asks for your word before it publishes.** The lead pushes a
branch, opens a pull request or comments only after you say so (CULTURE.md, and
"Publish only on the person's word" in the lead's role). With prompts off,
neither Claude Code nor Codex enforces that: it rests on the seats following
their instructions.

At start each seat runs `rig startup-proof submit`, and `rig ps --nodes` shows
ORIENTED `verified` once it has.

### Going back to OpenRig's default posture

Remove the `permission_policy: builtin:yolo` line from `rig.yaml` before you
launch. It applies to the next launch from the spec. A seat that is already
running keeps its permissions, and so does a stopped rig when OpenRig restores
it (see "Already running" in docs/reference/getting-started.md).

In the default posture, Claude Code seats launch with `acceptEdits`: file edits
go ahead, and other commands, including `rig`, follow your Claude Code rules and
prompts. Claude seats ask once to run `rig startup-proof submit` unless `rig`
commands are already allowed. Codex seats launch with `-s workspace-write`. The
two sections below cover what changes for each.

#### Fewer prompts for the commands the seats run

Claude seats ask before some ordinary commands they run while working, such as
creating directories, committing and running the tests. To stop those prompts
for this project only, merge these entries into `.claude/settings.local.json` in
your openrig clone before launch, and keep the file valid JSON: OpenRig writes
its own hooks into the same file at launch. The clone's `.gitignore` already
keeps `.claude/` out of your commits.

```json
{
  "permissions": {
    "allow": [
      "Bash(rig *)",
      "Bash(git add *)", "Bash(git commit *)", "Bash(git fetch *)",
      "Bash(git worktree add *)", "Bash(git worktree list *)", "Bash(git switch -c *)",
      "Bash(npm run *)", "Bash(npm test *)", "Bash(npx vitest *)", "Bash(npx tsc *)",
      "Bash(mkdir *)", "Bash(basename *)", "Bash(dirname *)"
    ],
    "ask": ["Bash(git push *)", "Bash(gh *)"]
  }
}
```

Claude Code checks `ask` rules before `allow` rules, so pushing and GitHub
commands still prompt. A spelling such as `git -C <dir> push` does not match the
`ask` rule, so the lead's role still says to publish only on your word. Commands
not listed keep asking. To have your agent add these entries and later remove
exactly them, see "Have your agent configure permissions" in
docs/reference/getting-started.md. This does not affect Codex seats.

#### Codex seats and the sandbox

`-s workspace-write` blocks network access, including localhost and so the
local OpenRig daemon. The reviewer and QA seats then cannot run `rig` commands,
`npm install`, `git fetch` or `gh`, or the package tests and stub-agent
scenarios that start a private daemon on localhost. Those commands fail, or wait
for your approval in that seat's terminal, depending on your Codex approval
setting. ORIENTED reads `missing` for them
([openrig #275](https://github.com/mvschwarz/openrig/issues/275)). The seats can
still read the code and the implementer's commits, run the typecheck and run
tests that need no network, and they say which failures come from the sandbox.
The lead reaches them with `rig send` and reads their reports with `rig capture`.

To give the two Codex seats network access while keeping approvals, opt in
before launch:

1. Create a Codex named profile called `openrig-dev-net`, as described under
   "Codex: select sandbox and approvals together" in
   docs/reference/getting-started.md, with these settings:

   ```toml
   sandbox_mode = "workspace-write"
   approval_policy = "on-request"

   [sandbox_workspace_write]
   network_access = true
   ```

2. In `rig.yaml`, uncomment `codex_config_profile: openrig-dev-net` on the
   `review` and `qa` members.
3. Launch, then check `/status` in each Codex seat before giving it work.

This grants those seats network access in general, not only to the daemon.

## Limits

- **A starter, not a process.** The team prepares one pull request. Merging,
  releases and maintainer decisions stay with the openrig maintainers.
- **The seats run on your installed OpenRig, not your checkout.** Tests use the
  repository's own harnesses, which start a private daemon and tmux server. Seeing
  your change drive real Claude Code or Codex seats needs an isolated
  environment (CONTRIBUTING.md), which this rig does not set up.
- **Stub scenarios have limits.** Host mode cannot run a seeded regression; the
  seeded pair runs in CI, or on a Docker host you reach over SSH. A stub proves
  OpenRig's plumbing, not provider behaviour. docs/as-built/test-layers.md has
  the details.
- **Four seats share one clone.** Each seat that builds uses its own worktree
  and `npm install`, which costs disk and time.
- **Four seats run at once,** so expect four seats' worth of provider usage.
- **Every map here is incomplete.** These files, the developing-openrig skill and
  the repository's maps can be stale. The code and its behaviour decide.
