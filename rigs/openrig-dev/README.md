# openrig-dev

A four-seat OpenRig team for working on OpenRig itself. You launch it from your
clone of the openrig repository, give the lead an issue, and the team turns it
into one pull request with an honest description. You decide when it is pushed.

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

- OpenRig installed (`rig --version`), Node 22 or 24, and tmux.
- Claude Code and Codex installed and logged in.
- A clone of the openrig repository, set up as CONTRIBUTING.md describes
  (`npm install`, `npm run build`).
- A clone of this repository, anywhere on disk.

Keep OpenRig's instruction files out of your pull requests. OpenRig writes them
into your clone, and the openrig repository does not ignore them. From your
openrig clone:

```sh
printf '%s\n' CLAUDE.local.md AGENTS.md gate-lane-verdict.json >> .git/info/exclude
```

This file is local to your clone and is never committed. It applies to the
worktrees the seats create, too.

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
terminal, or send from any shell:

```sh
rig send build-lead@openrig-dev "Please take issue #<number>: <one line on what you want>"
```

Stop the team with `rig down openrig-dev`. That removes OpenRig's blocks from
`CLAUDE.local.md` and `AGENTS.md`. The seats' git worktrees under `.worktrees/`
stay; remove them with `git worktree remove` when you are done.

## Permissions

The rig sets no permission policy, so every seat starts in OpenRig's default
posture. Nothing here changes your permissions for you.

**Claude Code seats** launch with `acceptEdits`: file edits go ahead, and other
commands, including `rig`, follow your Claude Code rules and prompts. If you
want to stop approving each `rig` command, see "Have your agent configure
permissions" in docs/reference/getting-started.md.

### Codex seats and the sandbox

Codex launches with `-s workspace-write`, and that sandbox blocks network
access, including localhost and therefore the local OpenRig daemon. With the
default posture, the reviewer and QA seats cannot run:

- `rig` commands (`whoami`, the queue, `context`),
- `npm install`, `git fetch` or `gh`,
- the many package tests and every stub-agent scenario that start a private
  daemon on localhost.

Those commands fail, or wait for your approval in that seat's terminal,
depending on your Codex approval setting. The seats can still read the code and
the implementer's commits (worktrees share your clone's git directory), run the
typecheck, and run tests that need no network. A failure caused by the sandbox
is not a product failure, and the seats are told to say which is which. The
lead reaches them with `rig send` and reads their reports with `rig capture`.

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

This grants those seats network access in general, not only to the daemon. It is
not a live switch: a seat that is already running keeps its permissions until a
relaunch. The getting-started guide covers precedence and the other options.

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
