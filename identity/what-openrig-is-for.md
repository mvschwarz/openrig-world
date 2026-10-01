# What OpenRig is for

## What it is

OpenRig runs a team of coding agents on your own machine as one system. Each agent is an
ordinary, unmodified Claude Code or Codex session (or a plain terminal, a Pi runner, or a scripted
test stub) running in tmux. A local daemon keeps the team's state, and people and agents drive it
through the `rig` CLI, a terminal UI and an MCP server.

What OpenRig adds is the coordination around the agents: launching and restoring them, delivering
messages between them, keeping durable work in a queue, and giving each agent the right skills and
context.

## How we judge a change

OpenRig is a coordination layer for a trusted environment: it should help agents and people keep
work flowing. A change that removes friction, or makes state more truthful, is usually welcome. A
change that adds a refusal, a prompt or a required step needs the concrete case in
CONTRIBUTING.md: who is harmed, how, and what it costs everyone else.

"Trusted environment" means your own machine or a private network, for you and people you trust.
OpenRig is not built for the open internet, and it does not act for you in the outside world. The
"Before a security or integration PR" section of `CONTRIBUTING.md` says this in full.

"More truthful state" means things like: a command that reports *unknown* when it cannot tell,
instead of *idle* or zero; a status that changes only when the underlying thing changed; empty
output that is never presented as a finished job.

## Where to read more

All paths are relative to the root of an OpenRig checkout.

- `README.md`: what OpenRig does for a user, and what it changes on your machine.
- `ARCHITECTURE.md`, section "What OpenRig is": the same description, attached to the code.
- `CONTRIBUTING.md`: what a pull request needs, and what review looks like.
