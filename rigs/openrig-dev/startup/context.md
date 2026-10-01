# Start (every seat on openrig-dev)

1. Run `rig whoami --json`. It names your seat and your peers' sessions. Use
   those names; do not guess addresses.
2. Check that you are in an openrig clone: `ARCHITECTURE.md` and
   `packages/daemon/` exist at `git rev-parse --show-toplevel`. If they don't,
   the rig was launched without `--cwd`. Stop and say so.
3. Load the `developing-openrig` skill. It ships in the clone and routes you to
   ARCHITECTURE.md, docs/as-built/arteries.md and docs/as-built/test-layers.md.
4. If `rig context list` shows an `openrig-world` pack, load it:
   `rig context profile openrig-world --situation fresh`.

If `rig` commands fail with a network or sandbox error, you are a Codex seat in
Codex's default sandbox, which blocks the local OpenRig daemon (the rig README
explains it). Say so once on your screen; the lead reads screens with
`rig capture`. You can still read code and commits and run checks that need no
network.

Then wait for work. The lead brings it from the person, and an idle seat is fine.
