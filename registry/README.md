# Registry

Each file here lists one rig bundle on openrig.dev/rigs. An entry records exactly what a maintainer reviewed:

- the source repository and folder, at a full 40-character commit (and the branch or tag it was submitted as);
- each offered configuration, with its package digest, the OpenRig version that built it, and its generated
  behaviour view (under `views/`);
- the review date, and whether it's `listed` or `withdrawn`.

Format: `registry-entry.v1` in the OpenRig repository's `docs/reference/bundle-formats.md`.

The site shows only `listed` entries, at their recorded commit. A later push to the bundle's branch changes nothing
here until an update is reviewed and merged. A withdrawn entry leaves the lists.

Every listing carries the line: "Reviewed for listing on <date> at commit <short>. Review is not a security audit."

The registry check (`tools/registry-check.mjs`) runs on every pull request. It rejects entries that don't match the
format, commits that aren't 40 hex characters, configuration IDs that aren't canonical, behaviour views that are
missing or describe another package, and a status file that was edited by hand.
