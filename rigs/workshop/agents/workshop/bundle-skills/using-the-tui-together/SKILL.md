---
name: using-the-tui-together
description: >
  Use when you notice something the person would want to see (a seat waiting on them, a seat that has stalled or
  keeps failing, work that needs their decision), when they ask what the team is doing or where some work stands,
  or in their first session with this rig, and the OpenRig TUI could show it to them better than a paragraph of text.
---

# Using the TUI together

The OpenRig TUI is the person's view of the team: rigs, seats, specs, missions and what needs them, in one terminal.
Agents can drive it with the same commands people use, so you can drive it while the person watches. Watching you is
how most people learn it.

## Offer, don't take over

Offer once, in one line, saying what you noticed:

> I'm noticing dev-review has been waiting on a permission prompt for ten minutes. Want me to show you in the TUI?

Good moments to offer:
- a seat is waiting on the person: a prompt, a menu or a decision;
- a seat has stalled or keeps failing;
- the person asks what the team is doing, or where some work stands;
- the person's first session with this rig.

If they say no, don't offer again for the same thing. Never answer a prompt or menu for them: show them where it is
and let them answer it.

## Open it

The person sees only what is open in a terminal they can see. Something you open from your own shell isn't in front of
them, so open it where they're looking, or tell them what to run.

- `rig tui` opens the TUI in the current terminal.
- `rig tui --shared` joins the shared TUI that OpenRig's kernel rig runs, so you and the person see the same screen.
  Detach with Ctrl-b d.
- To show the seats' own terminals:
  - **On a desktop:** `rig terminal open <rig> --window` opens each live seat as a tile in a new terminal window or
    tab, in front of the person (herdr if it's installed, otherwise tmux). Use `--window`: without it the tiles can
    open where nobody sees them. Versions before 0.6.7 have no `--window` (`rig terminal open --help` shows yours);
    there, give the person the attach commands below.
  - **Headless, such as over SSH:** nothing can open in front of the person. Tell them plainly to open a terminal on
    this machine and attach, and give them the commands: `rig ps --nodes --rig <rig> --json --fields
    canonicalSessionName,tmuxAttachCommand` prints one for each seat.
  - Then ask whether they can see it. A command that succeeded doesn't show what's on their screen.

## Drive it, saying what you're doing

Type into the command bar the way the person would, with one line before each step, so they learn the commands:

| To | Type |
|---|---|
| Jump to a section | `:topology`, `:specs`, `:scopes`, `:terminals`, `:needs`, `:system`, `:config`, `:connections` |
| Filter the rows | `/text` |
| Open one thing | `rig <name>`, `pod <name>`, `agent <pod.member>`, `spec <name>` or `host <name>` |
| Change how the selection is shown | `tab <name>`: a running rig has `table`, `recent`, `overview`, `graph` and `health`; a rig spec has `topology`, `configuration` and `yaml` |
| Go from an agent to its spec, or the other way | `spec-of <pod.member>`, `running <spec>` |
| See every command | press `?` on its own, or type `help` (`rig tui commands --json` from a shell) |
| Move around | arrows and Enter; Escape steps back; `q` quits |

Two things that trip people up:
- **Section labels:** the explorer labels two sections differently from their commands. `:needs` shows as FEED and
  `:scopes` as PROJECTS; `:feed` and `:projects` don't work.
- **Agent names:** `agent` and `spec-of` take the dotted id (`orch.lead`), not the session name (`orch-lead@workshop`).

From outside the TUI's pane, send the same keys with `tmux send-keys -t <pane> ':needs' Enter`, or use the TUI's
control socket: `$OPENRIG_TUI_SOCKET`, or `$OPENRIG_HOME/run/tui-<id>.sock` (`tui-kernel.sock` for the shared TUI).
It takes one command per line and answers with one JSON line. Both go through the same path as the keyboard.

## Show, then hand back

- **Point at the thing:** "This row is the prompt. It's in dev-review."
- **Pair it with the command that acts on it,** and let the person run it or ask you to. For a seat waiting on the
  person, `rig ps --nodes --rig <rig>` marks it `att` and gives the reason and the exact `rig seat continue <seat>`.
- **Look, don't change.** The TUI is built for looking and navigating. Don't change anything from it unless the
  person asked for that change.
- **When the person takes the keyboard, stop typing.**

## Reading the person's screen

Claude Code shows dim autocomplete text that looks like something typed. Before you treat text at a prompt as the
person's, check whether it's dim: `tmux capture-pane -e -p` shows the escape codes, and dim text starts with `ESC[2m`.
