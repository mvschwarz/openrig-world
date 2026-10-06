# secrets-manager reference

A retained reference for HashiCorp Vault in development mode and one Claude
Code specialist. It needs Docker Compose and an available port 8200. The
original compose file uses a fixed development token and is for local examples,
not a production secrets service. Installing it can start that service.

The source and agent resources were copied from OpenRig commit
`98efdd11482638da67409a61da061c4d9845c76d`. Their original relative layout is
preserved under `rigs/launch/` and `agents/`. The plugin reference
`openrig-home:plugins/openrig-core` resolves on the installing host; it is not
vendored or covered by this bundle's package digest.

The installable `rig.yaml` adds only `docs: [{path: secrets-manager.compose.yaml}]`
to the original `world-bundle.yaml`. This makes the existing assembler carry the
compose asset at the path already named by `services.compose_file`; service
configuration and the retained original spec are unchanged.

From the repository you intend the team to work in, preview the bundle:

```sh
rig bundle install https://github.com/mvschwarz/openrig-world/tree/main/rigs/launch/secrets-manager --target ~/rigs/secrets-manager --cwd . --plan
```

Use the registry's exact commit link for reproducible bytes. Removing `--plan`
installs and starts the rig; a preview does not exercise agents or services.
These retained references have no new native launch claim.
