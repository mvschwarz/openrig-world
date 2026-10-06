# factory-rsi reference

A retained seven-seat reference for the recursive improvement factory. Its
`factory-rsi` workflow and the installed `openrig-core` plugin remain OpenRig
dependencies. Read `CULTURE.md` before selecting it; it describes the original
loop and release gate, not a newly tested runtime outcome.

The source and agent resources were copied from OpenRig commit
`98efdd11482638da67409a61da061c4d9845c76d`. Their original relative layout is
preserved under `rigs/launch/` and `agents/`. The plugin reference
`openrig-home:plugins/openrig-core` resolves on the installing host; it is not
vendored or covered by this bundle's package digest.

The installable `rig.yaml` has the same bytes as `world-bundle.yaml`.

From the repository you intend the team to work in, preview the bundle:

```sh
rig bundle install https://github.com/mvschwarz/openrig-world/tree/main/rigs/launch/factory-rsi --target ~/rigs/factory-rsi --cwd . --plan
```

Use the registry's exact commit link for reproducible bytes. Removing `--plan`
installs and starts the rig; a preview does not exercise agents or services.
These retained references have no new native launch claim.
