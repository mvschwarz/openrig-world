# Tells of a wrong claim

These are not principles. They are triggers: patterns you can notice in the moment, each paired with
what it usually means and the cheapest thing that settles it. A principle like "be rigorous" applies
everywhere, so it fires nowhere. A tell fires when its moment arrives.

Every entry here cost someone real time while building OpenRig. They are grouped by the moment you
are in, because that is the only index that works when you are inside the mistake.

## You are about to say something is not there

This is the most expensive family. A false absence sends people to rebuild something that exists, or
to doubt a correct report.

| The tell | What it usually means | The cheapest check |
|---|---|---|
| A search came back empty | Your pattern was wrong, far more often than the thing is missing | Run the same search against something you know exists |
| It is not in the place you looked | You searched for a name, not for what the thing does | Search for the behaviour, and open the files whose names suggest they do it |
| You are about to say a capability does not exist | You looked for the one implementation you imagined | `rig --help`, `rig <command> --help`, and the recipes in `ARCHITECTURE.md` |
| Several checks agree it is missing | They shared one method, so they are one data point | Ask what each check actually did; the same command on the same path counts once |
| A narrow search backs a broad claim | Absence needs a different proof from presence | Say what you searched: "no references under this path", not "nothing uses it" |

## You are about to trust a result

| The tell | What it usually means | The cheapest check |
|---|---|---|
| Every case returns the same verdict | The instrument is broken, not the world | Add one case whose answer you know is different |
| A check passed after examining zero items | It proved nothing and reported success | Make zero items a loud skip, and print the count |
| A command said it succeeded | A success message and an effect are different things | Read back the state the command was meant to change |
| A path resolved or a file opened | A path that resolves is not data that exists; an empty file opens fine | Check the size and the contents |
| A listing shows zero, empty or truncated | Displays cap, filter and project; they lose data in the "nothing here" direction | Read the full record from its source, for example with `--json` |
| A delivery reported failure | Failure signals are wrong too, and a retry after a false failure duplicates | Check the effect first: capture the pane, or read the queue item |

## You are about to trust a report

| The tell | What it usually means | The cheapest check |
|---|---|---|
| A document's metadata disagrees with its body | The label is stale and the body is real | Read the body; fix the label |
| Someone else's work looks broken | They may be in the middle of it | Check for an open branch, a draft pull request, or a recent comment before you file it |
| You are repeating a claim you inherited | Testimony is not evidence, however confident it sounds | Find the source, or mark the claim unverified |
| You read that file a while ago | Recall is not a citation | Open it again before you quote it |

## You are about to change something

| The tell | What it usually means | The cheapest check |
|---|---|---|
| The docs changed and the tool did not | Something still generates the old convention | Find what generates it before you edit what describes it. Docs that lie are annoying; tools that lie rebuild what you removed |
| You just fixed one instance | The thing that produced it may still be running | Search for siblings, and fix the cause |
| You are syncing copies by hand | The next build may regenerate them from a source you did not touch | Find the source first. In OpenRig, shipped skills live in several copies and generated context packs are rebuilt at package time; `ARCHITECTURE.md` says which is which |
| Several copies of the same thing exist | You may be editing one that nothing reads | Find the live copy first. Your checkout is not the installed daemon, and `packages/cli/daemon/` can hold a stale vendored copy |
| You want to keep something because changing it is work | Convenience dressed up as a technical reason | Ask what is best for the people using OpenRig, then decide |

## You are about to write for another agent

This covers pull request descriptions, issue reports, docs and skills, for agents and for people.

| The tell | What it usually means | The cheapest check |
|---|---|---|
| Your example uses real data | The reader can now pass by recall instead of by looking | Use a made-up example |
| You are describing a local mess as how things work | You teach every later reader to distrust a mechanism that works | Ask the config or the command for the real answer, and describe that |
| You wrote "you may consult X" | An affordance without a trigger goes unused | Say when to read X, and what only X can tell you |
| You are summarising something you are also shipping | The summary becomes a second source and drifts | Link to it instead |
| Your reader cannot run what you cite | You gave a map to someone who needs the evidence | Include the command and its output, redacted, for readers outside your environment |

## How to use this page

Do not read it top to bottom and feel prepared. It is a lookup table for a moment. Its value is
recognising "this is the empty-search one" while your hands are on the keyboard.

One rule sits under almost every entry: **your instrument is more likely to be broken than the world
is to be surprising.**

Add an entry only with a real cost attached, and say what it cost in the pull request. An entry that
never caught anyone is a preference, and it dilutes the ones that fire. If a tell here never fires
for you, that is worth reporting too.
