# secrets-manager reference

A source-only reference for HashiCorp Vault in development mode and one Claude
Code specialist. Teams with a built-in service can't install from a bundle yet,
so this reference is not listed as installable. This also applies to GitHub
folder links, which the installer turns into bundles.

Running the source needs Docker Compose and an available port 8200. The
original compose file uses a fixed development token and is for local examples,
not a production secrets service.

The source and agent resources were copied from OpenRig commit
`98efdd11482638da67409a61da061c4d9845c76d`. Their original relative layout is
preserved under `rigs/launch/` and `agents/`. The plugin reference
`openrig-home:plugins/openrig-core` resolves on the installing host; it is not
vendored or covered by this bundle's package digest.

The `rig.yaml` adds only `docs: [{path: secrets-manager.compose.yaml}]`
to the original `world-bundle.yaml`. This makes the existing assembler carry the
compose asset at the path already named by `services.compose_file`; service
configuration and the retained original spec are unchanged.

The archive contains the Compose file, but its plan is refused with
`services_unsupported`: service-backed rigs require a stable source directory.
No archive or installable registry entry is offered for this reference. A source
directory launch, agent startup and service startup have not been tested here.
