# workshop with a review pair

[Workshop](../workshop/) (`rigs/workshop`, four seats) is the recommended team; choose
this variant when you want a second, independent reviewer on another runtime.

A five-seat variant of [Workshop](../workshop/): the same OpenRig team, but with two
independent code reviewers, one Claude Code and one Codex, instead of one. It works
in any repository, OpenRig's own included.
You install it once as `workshop` in `~/rigs/workshop` and launch it in your
project. The lead starts from your goal, scopes the work and routes it to the
builder, QA and the two reviewers, and compares the two reviews. Continuing work gets a light mission and first
slice; questions and exploration get an answer. You decide when work is pushed. Every seat runs with
permission prompts off; "Permissions" below says what that means and how to
turn them back on.

| Seat | Runtime | Does |
|---|---|---|
| `orch-lead@workshop` | Codex | Starts from your goal, scopes it, hands it on and owns the PR description. Talk to this seat. |
| `dev-build@workshop` | Claude Code | Makes the change on its own branch and worktree, and runs the repository's build and tests. |
| `dev-qa@workshop` | Claude Code | Runs the checks the change calls for and reports what each one proved. |
| `review-r1@workshop` | Claude Code | Reviews the handed-off commit against the repository's maps and the code, and runs the tests that bear on it. |
| `review-r2@workshop` | Codex | Reviews the same commit the same way, independently of `review-r1`. |

These are the recommended runtimes. `configurations.yaml` also offers a
supported runtime per seat; each reviewer can use Claude Code or Codex, and the
pair is worth having when they differ. Every choice keeps the same five seat
names, rig name and install directory; configuration IDs identify the packaged
runtime choice, not another install. This team is also named `workshop` and
installs in `~/rigs/workshop`, so install one of the two folders, not both.

`CULTURE.md` holds the team's values. Each seat's role is in
`agents/workshop/guidance/`, the same files as Workshop's; what the pair adds is in
`startup/review-pair-*.md`. In a clone of OpenRig, the seats also load that
repository's own `developing-openrig` skill.

## Before you start

- OpenRig 0.6.6 or later (`rig --version`), Node 22 or 24, and tmux.
- The providers selected for your seats installed and logged in. The recommended
  mix needs Claude Code and Codex; a single-provider configuration needs only
  that provider. Pi limitations are in `agents/workshop/PI-SKILLS.md`.
- A clone of the repository you want to work on, set up the way its README or
  CONTRIBUTING says.
- To publish the pull request: a GitHub account that can fork repositories and
  open pull requests, with push credentials configured on this machine.

Keep OpenRig's files out of your commits. OpenRig writes instruction files,
settings and helper scripts into your clone, and in an OpenRig clone the QA
seat's `npm run gate` writes `gate-lane-verdict.json`. From the root of your clone:

```sh
printf '%s\n' CLAUDE.local.md AGENTS.md /.openrig/ .claude/settings.local.json gate-lane-verdict.json >> .git/info/exclude
```

This file is local to your clone and is never committed. It applies to the
worktrees the seats create, too. If you skip this step, the lead adds any
missing entries when it starts, along with the skill folders the rig puts in
`.claude/skills/` or `.agents/skills/`. An exclude line can't hide a file the
repository already tracks: if yours tracks `AGENTS.md` or `CLAUDE.local.md`,
OpenRig's block shows up as a change to it, and the seats keep that file out of
their commits.

Optional: add OpenRig's public context pack, so the seats load it at start:

```sh
rig context add --git https://github.com/mvschwarz/openrig-world
```

**If you ask Claude Code to do this setup for you,** plan to run some steps
yourself. In OpenRig's tests on macOS, Claude Code's default auto mode declined
the `rig up` line (`[Create Unsafe Agents]`, because it starts new agents) on
2.1.289 and 2.1.290, and in an earlier 2.1.289 run also declined adding a
permission rule for itself (`[Self-Modification]`; add any rule yourself with
`/permissions` or in `.claude/settings.local.json`) and `rig context add --git`
(`[Untrusted Code Integration]`), even with an allow rule for that command. Run
`rig context add --git` and `rig up` yourself in a terminal, from the root of
your clone.

## Run it

The installing agent reads `configurations.yaml`, chooses runtimes supported by
your logged-in providers, and installs this bundle to `~/rigs/workshop`. For
example, from your project's clone with both Claude Code and Codex available:

```sh
rig bundle install https://github.com/mvschwarz/openrig-world/tree/main/rigs/workshop-review-pair --preset recommended --target ~/rigs/workshop --cwd . --plan
rig bundle install https://github.com/mvschwarz/openrig-world/tree/main/rigs/workshop-review-pair --preset recommended --target ~/rigs/workshop --cwd .
```

The first command previews the install; the second installs and launches it.
With one provider, install [Workshop](../workshop/) instead. Both use the **same**
`--target ~/rigs/workshop`, never a per-option folder or rig name.
For a reviewed version, use the registry's exact commit link instead of `main`.

When working from a clone of this repository, preview the authored spec with
`rig up <path-to>/openrig-world/rigs/workshop-review-pair/rig.yaml --cwd . --plan`.
`--cwd .` selects your project: without it, member working directories resolve
against the spec's folder. Each seat checks this at start.

The lead claims the goal row supplied by the kernel operator. It asks only a
question that changes what it would do, then records continuing work lightly
and offers to plan and build. If you supplied no goal, it may propose one
repository task and ask before starting.

**Reaching the team.** The rig is named `workshop` unless it was launched under
another name (`rig ps` lists your rigs), and the lead's session is
`orch-lead@<rig>`. Use whichever suits you; an agent that installed the team
for you can do the first one itself:

- From any shell, read the lead's screen with `rig capture orch-lead@workshop`
  and answer with `rig send` (below).
- Put a terminal on the lead with `tmux attach -t orch-lead@workshop`. From
  inside tmux, use `tmux switch-client -t orch-lead@workshop`. Press Ctrl-b,
  then d, to leave it running. `rig ps --nodes --rig workshop --json --fields canonicalSessionName,tmuxAttachCommand`
  prints this command for every seat.
- Run `rig` for OpenRig's TUI.
- Open every seat as a tile in a new terminal window with
  `rig terminal open workshop --window`, run on the machine's desktop (herdr if
  it's installed, otherwise tmux; versions before 0.6.7 have no `--window`).
  Without a desktop, such as over SSH, use the `tmux attach` commands above.

A message from your own terminal arrives marked as from an unsigned sender;
start it with your name if you want the lead to know who sent it:

```sh
rig send orch-lead@workshop "Please take issue #<number>: <one line on what you want>"
```

At first start the lead also publishes the team's roster, `<workspace.root>/rosters/workshop.json`
(named after the rig), if there isn't one yet. Need expertise your team lacks? `rig roster find <topic>` lists who to ask and why.

Stop the team with `rig down workshop`. That removes OpenRig's blocks from
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

The bundle also declares `non_interruptive: true`. You do not need a separate
flag or an advance warning-acceptance step: for full-bypass seats, OpenRig
accepts Claude Code's bypass-permissions warning with a launch flag and hides
Codex's supported full-access and GPT-5.1 migration notices. It writes no
warning-acceptance settings to your Claude or Codex configuration. The choice
is saved on this rig for later launches and restores.

The before-install view shows the broad access and the declared non-interruptive
default. Sign-in remains yours; unsupported or new harness notices can still
stop a seat (Codex's GPT-5.1-Codex-Max notice is one today). Pi keeps full
resource trust and has no added warning flag. OpenRig's
`docs/reference/non-interruptive-mode.md` lists the supported notices.

To keep the harness warning prompts, add `--no-non-interruptive` when installing.
For an existing rig, run `rig down workshop`, then
`rig up workshop --existing --no-non-interruptive`. This overrides the bundle's
choice without changing its permission policy or erasing earlier native
warning acceptance.

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

At start each seat runs `rig startup-proof submit`, and `rig ps --nodes --full`
shows ORIENTED `verified` once it has.

### Going back to OpenRig's default posture

Remove the `permission_policy: builtin:yolo` and `non_interruptive: true` lines
from `rig.yaml` before you launch. It applies to the next launch from the spec. A seat that is already
running keeps its permissions, and so does a stopped rig when OpenRig restores
it (see "Already running" in OpenRig's `docs/reference/getting-started.md`).

In the default posture, Claude Code seats launch with `acceptEdits`: file edits
go ahead, and other commands, including `rig`, follow your Claude Code rules and
prompts. Claude seats ask once to run `rig startup-proof submit` unless `rig`
commands are already allowed. Codex seats launch with `-s workspace-write`. The
two sections below cover what changes for each.

#### Fewer prompts for the commands the seats run

Claude seats ask before some ordinary commands they run while working, such as
creating directories, committing and running the tests. To stop those prompts
for this project only, merge entries like these into `.claude/settings.local.json`
in your clone before launch, adding your repository's own build and test
commands. Keep the file valid JSON: OpenRig writes its own hooks into the same
file at launch. The exclude line above keeps it out of your commits.

```json
{
  "permissions": {
    "allow": [
      "Bash(rig *)",
      "Bash(git add *)", "Bash(git commit *)", "Bash(git fetch *)",
      "Bash(git worktree add *)", "Bash(git worktree list *)", "Bash(git switch -c *)",
      "Bash(npm test *)",
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
exactly them, see "Have your agent configure permissions" in OpenRig's
`docs/reference/getting-started.md`. This does not affect Codex seats.

#### Codex seats and the sandbox

`-s workspace-write` blocks network access, including localhost and so the
local OpenRig daemon. The lead and `review-r2` in the recommended mix then cannot run `rig`
commands, install dependencies, run `git fetch` or `gh`, or run tests that need
the network or a local server. Those commands fail, or wait for your approval in
that seat's terminal, depending on your Codex approval setting. ORIENTED reads
`missing` for them ([openrig #275](https://github.com/mvschwarz/openrig/issues/275)).
The seats can still read the code and the builder's commits and run checks that
need no network, and they say which failures come from the sandbox. A person or agent with daemon access
reaches them with `rig send` and reads their reports with `rig capture`.

To give the two Codex seats network access while keeping approvals, opt in
before launch:

1. Create a Codex named profile called `workshop-net`, as described under
   "Codex: select sandbox and approvals together" in OpenRig's
   `docs/reference/getting-started.md`, with these settings:

   ```toml
   sandbox_mode = "workspace-write"
   approval_policy = "on-request"

   [sandbox_workspace_write]
   network_access = true
   ```

2. In `rig.yaml`, uncomment `codex_config_profile: workshop-net` on `orch.lead`
   and `review.r2` (or the seats assigned Codex in your configuration).
3. Launch, then check `/status` in each Codex seat before giving it work.

This grants those seats network access in general, not only to the daemon.

## Limits

- **A starter, not a process.** The team prepares one pull request. Merging,
  releases and maintainer decisions stay with the repository's maintainers.
- **Five seats share one clone.** Each seat that builds uses its own worktree
  and installs the repository's dependencies there, which costs disk and time.
- **Five seats run at once,** so expect five seats' worth of provider usage.
- **In a clone of OpenRig,** the seats run on your installed OpenRig, not your
  checkout. The repository's own test harnesses start a private daemon; its
  `docs/as-built/test-layers.md` says what each layer can prove.
- **Every map here is incomplete.** These files and the repository's own maps
  can be stale. The code and its behaviour decide.
