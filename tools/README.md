# openrig-world tools

Two small Node programs that keep the registry and the public status file honest. They read files in this
repository (and, for the generator, run records on the machine running it). They don't fetch anything, install
anything, or run anything a submitted bundle contains.

| Program | What it does | Where it runs |
|---|---|---|
| `registry-check.mjs` | Checks `registry/*.yaml`, each entry's behaviour views, `status/journeys/` and `status/status.json` | CI on every pull request and push to main |
| `status.mjs` | Generates `status/status.json` from run records, or checks that the committed file equals regenerated output | Wherever the run records and their receipts are kept |

```sh
cd tools && npm ci --ignore-scripts
node --test test/*.test.mjs
node registry-check.mjs
node status.mjs generate --records <folder> [--records <folder> ...]
node status.mjs check --records <folder> [--records <folder> ...]
```

## Formats

The formats are defined in the OpenRig repository's `docs/reference/bundle-formats.md`. This folder keeps a copy of
the schemas it validates against in `schemas/product/`, pinned in `schemas/product/source.json` by commit and SHA-256.
The check refuses a copy that differs from its pin. To update the copy, fetch the schemas at the new commit, then
update `commit` and each file's `sha256` in `source.json` in the same pull request.

Journeys are defined here, in `status/journeys/<id>-v<version>.json` (schema: `schemas/journey.v1.schema.json`). A
journey lists the steps a run must pass. Its `kind` is `team` (a whole team, which can earn a label) or
`harness_check` (one harness on one machine, shown as its own line and never a team label).

## Run records

Run records are private. They're kept beside the receipts they rest on, in a `run-records/` folder:

```
<run folder>/
  <receipt files>
  run-records/
    <listing slug>/<record id>.json     team runs for that listing
    _harness/<record id>.json           harness checks
```

A record's `evidence.receipt.ref` is relative to the run folder. The generator reads the receipt and compares its
SHA-256. Only the fields listed in the status schema reach `status.json`. Of a record's own text, only
`outcome.publicNote` does, and the generator refuses to write a status file that contains a private path, an
address, a queue row id, an IP address or a non-GitHub URL.

## The status rule (`openrig.status-rule/v1`)

Labels are per listing, configuration and environment: the run's platform and architecture as Node reports them
(`process.platform`-`process.arch`, for example `linux-x64`; the status format allows `linux`, `darwin` or `win32` with
`x64` or `arm64`). In order:

1. **Readability.** If any record for a listing can't be read, isn't a v1 run record, or names a journey that
   doesn't exist, or ran on an environment outside that set, the whole listing is `status_unavailable`. That's decided first, so a damaged record never reads as
   "Not tested". An unreadable harness-check record makes `harnessChecks` unavailable in the same way.
2. **Drop.** Records named in another record's `supersedes` or `withdraws` support nothing, and neither does a record
   whose receipt is missing or changed. A relation stated by a dropped record still applies, so losing a correction can
   only remove a claim, never restore one.
3. **Match.** A record applies to a configuration when its source repository and folder, configuration ID and package
   digest match the listing. A record for another package applies only through that configuration's `evidenceReuse`,
   and then the label shows both digests. Community reports are counted separately and never label.
4. **Label.**
   - `known_problem`: a FAIL that's unresolved. A FAIL is resolved only by a record in force that names it in
     `resolves`, passes that step, and ran on the same or a newer OpenRig version.
   - Otherwise the best record decides: `tested` (every required step passed, with no help), `tested_with_help`
     (every required step passed, with help), `partly_tested` (some passed). A tie goes to the newest.
   - With no such record, `platforms` is empty, which means Not tested.

The OpenRig version is shown, not matched: a label carries forward to later releases, dated, until new evidence
changes it. Each label carries the date, OpenRig version, record ids and package digest(s) it rests on.

## Wording

The site shows the labels as: Known problem, Tested by OpenRig, Tested with help (N), Partly tested,
Not tested by OpenRig, and Status unavailable.

## `bodyDigest`

`status.json` ends with `bodyDigest`, the SHA-256 of the canonical JSON (RFC 8785) of every other top-level field. A
hand edit that doesn't regenerate the file fails the registry check. The digest catches mistakes; it isn't a
signature.
