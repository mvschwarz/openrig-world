# Start (every seat on this rig)

1. Run `rig whoami --json`. It names your seat and your peers' sessions. Use
   those names; do not guess addresses. During launch a peer may not be listed
   yet: if one of the four seats (the lead, the builder, the code reviewer and
   the QA seat) is missing, check `rig ps --nodes` again a little later before
   telling anyone it is missing.
2. Find the repository you work in: `git rev-parse --show-toplevel`. If that
   fails, or your working directory is this rig's own folder (it holds this
   rig's `rig.yaml`), the rig was launched without `--cwd`. Stop and say so.
3. Get the big picture before anyone changes anything:
   - In a clone of OpenRig (`ARCHITECTURE.md` and `packages/daemon/` at the
     root from step 2), load the `developing-openrig` skill. It ships in the
     clone and routes you to ARCHITECTURE.md, docs/as-built/arteries.md and
     docs/as-built/test-layers.md. Pi profiles also project a pinned copy. Its
     code-map links refer to your OpenRig checkout; resolve those maps from the
     root in step 2.
   - In any other repository, read its own maps: the README, and ARCHITECTURE,
     CONTRIBUTING, AGENTS.md or a docs index where it has them. Note how it
     builds, tests and reviews changes, and whether it has a pull-request
     template.
4. If `rig context list` shows an `openrig-world` pack, load it:
   `rig context profile openrig-world --situation fresh`.

If you are a Codex seat and `rig` commands fail with a network or sandbox error,
Codex's default sandbox may be blocking the local OpenRig daemon (the rig README
explains it). Say so once on your screen; the lead reads screens with
`rig capture`. You can still read code and commits and run checks that need no
network.

Last, submit your startup proof: run the `rig startup-proof submit` command from
the "OpenRig startup orientation challenge" in your startup text, exactly as
given. It tells OpenRig and the lead that you read your start steps. If your
`rig` commands fail in the sandbox, say so instead.

Then the lead starts from the person's goal, usually delivered in the kernel
operator's queue row, and follows its "Your first move" startup guidance. It
does not ask for that goal again. Only when no goal was supplied does it
propose work from the repository. Everyone else waits for work. The lead
brings it, and an idle seat is fine.

Need expertise your team lacks? `rig roster find <topic>` lists who to ask and why.
