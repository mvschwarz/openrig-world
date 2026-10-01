# Proving a change

How to show that a change to OpenRig works, so that a reviewer can believe it without re-doing your
work. `docs/as-built/test-layers.md` in the product repository says which commands to run. This
page is about what a passing check does and does not tell you.

## Bugs hide at seams

The hardest bugs sit at a seam: the joint between two parts that are each correct on their own and
wrong together. A part has one owner, one test suite and one mental model. A seam has two of each,
and neither side's tests exercise the other side's assumptions. So a seam defect survives both
suites passing. "All tests green" is evidence about the parts and says nothing about the joints.

Before you believe a claim, name the seams it crosses. These come up again and again in OpenRig:

| Seam | Where it shows up |
|---|---|
| Lifecycle | Something outlives the thing it refers to: a pane id after a reboot, a name after its rig was archived |
| State sync | Two views of one fact disagree: a projection and its source, a cached status and the live process |
| Recovery | What survives a daemon restart, a reboot or a context compaction, and what quietly does not |
| Across hosts | A local name and a remote name for the same seat, or a request routed to the wrong daemon |
| Labels | A field that claims something was checked when it was only passed along |
| Stores | Two databases, two config roots, two home directories: a query of one says nothing about the other |
| Projection | Skills and files copied into a runtime's directory, compared with the source they came from |

`docs/as-built/arteries.md` lists real regressions in these places, such as stale tmux pane ids
after a reboot (#141) and Codex seats that skipped skills a Claude seat had already projected
(#159). Add seams to the list for your own change. Naming them before you test is the point.

## Test the joint, not only the parts

- **When a fix spans two parts, the proof has to exercise the joint.** Two green suites plus one
  happy-path integration test are evidence about the two parts, and none about the seam.
- **Write a negative case at the seam.** Positive tests prove a part works; a negative case at the
  joint proves the joint. To find one, put something plausible where something real should be:
  ask what the other side could send that is well-formed and wrong, then send it. In OpenRig that
  looks like a different service answering on the daemon's port, a tmux session name that outlived
  the session it named, or a config file that fails to parse during recovery.

## A check that cannot fail is decoration

For every check you rely on, plant the exact defect it claims to catch and watch it fail, at the
assertion you meant. A setup crash or a timeout is not the check catching the defect.

The project's CI scenario job works this way. It runs each of its queue scenarios three times:
healthy, then with exactly one queue row changed from `in-progress` to `pending` across a daemon
restart, then healthy again. The planted run counts only if it fails at the post-restart queue
assertion. A single healthy run proves only that one run passed.

Two smaller forms of the same rule:

- A check that examined zero items proved nothing. Make it skip loudly, and have it report how
  many items it looked at.
- If every case returns the same verdict, suspect the check before you believe the result.

## One pass cannot prove a lifetime property

State that lasts across passes (restarts, retries, re-runs, upgrades) is a seam between passes.
Accepting it takes more than one pass: run it, restart or run it again, and check again. Something
can be right on the pass you examined and wrong on the next one.

Upgrades are the sharpest case. A long-lived install applies every new migration in one start,
against real data, while every scenario starts from an empty database. If your change touches
persisted state, say how you checked an existing install, or say that you did not.

## Prove it by its effect

- **A success message is not the effect.** Read back the state the command was supposed to change,
  through the surface a user would read it from.
- **Prove a stop or a transition by every effect, not the convenient one.** A refused connection
  does not prove the process exited. A status that says *stopped* does not prove the pane is gone.
- **Compare a projected copy with its source by content,** for example with a hash, not by its name
  or a version label.
- **Give every absence its scope.** "Not found in this database, on this host, under this path" is
  a true statement. "Not there" usually is not.

## What to write in the pull request

Under "How you verified it", give the reviewer:

- the revision you tested, and any local changes on top of it;
- the commands you ran and what you saw;
- the seams your change crosses, and how you exercised each one;
- the defect you planted, and where it failed;
- what you could not run. For example, a stub scenario proves OpenRig's plumbing, not how Claude
  Code or Codex behave. See "What a stub can and cannot prove" in `docs/as-built/test-layers.md`.
