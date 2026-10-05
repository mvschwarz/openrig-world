# openrig-world tools

Two small Node programs that keep the registry and the public status file honest. They read files in this
repository (and, for the generator, run records on the machine running it). They don't fetch anything, install
anything, or run anything a submitted bundle contains.

| Program | What it does | Where it runs |
|---|---|---|
| `registry-check.mjs` | Checks `registry/*.yaml`, each entry's behaviour views, `registry/submissions/`, `status/journeys/` and `status/status.json` | CI on every pull request and push to main |
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
`outcome.publicNote` does. The generator refuses to write a status file containing:
- an absolute path: any token that starts with one or more `/` and a non-space character, `~/`, or a drive letter with `:\` or `:/`,
  quoted or not, with any characters after it. A slash inside a word or a URL doesn't start one. Known limits:
  `path:/…` and `file:///…` pass, because the `:` that lets `https://` through also lets them through;
- an address;
- a queue row id;
- a private host name (`.local`, `.lan`, `.internal`);
- an IP address;
- a non-GitHub URL;
- text that isn't well-formed Unicode, which canonical JSON can't carry.

Plain names, a person's or a machine's, can't be recognised. Keep public notes short and factual: maintainers read
every status pull request.

## The status rule (`openrig.status-rule/v1`)

Labels are per listing, configuration and environment: the run's platform and architecture as Node reports them
(`process.platform`-`process.arch`, for example `linux-x64`; the status format allows `linux`, `darwin` or `win32` with
`x64` or `arm64`). In order:

1. **Readability.** If any record for a listing can't be read, isn't a v1 run record, names a journey that doesn't
   exist, or ran on an environment outside that set, the whole listing is `status_unavailable`. That's decided first,
   whatever the record's evidence kind, so a damaged record never reads as "Not tested". An unreadable harness-check
   record makes `harnessChecks` unavailable in the same way.
2. **Relations and receipts, settled per scope.**
   - A scope is what one label covers: a listing's configuration (its source, configuration ID and accepted package
     digests) on one platform, among records of a kind that can earn that label (`native-workflow` for team labels).
     For harness lines, it's one harness on one platform, among the kinds a harness line uses.
   - A `withdraws`, `supersedes` or `resolves` counts only from a record in the same scope. A record that could never
     earn the label (another kind, configuration or platform) can't withdraw, replace or resolve anything in it; its
     relation is ignored, not an error. To correct a mistaken FAIL, write an eligible record for the same scope.
   - Records that match no offered configuration play no part.
   - A record named in another record's `supersedes` or `withdraws` supports nothing.
   - A withdrawal counts only from a record that isn't itself withdrawn. So withdrawing a withdrawal restores what it
     withdrew, and a withdrawn record can't clear a FAIL. Withdrawals that form a cycle make the set unavailable.
   - A supersession counts from any record that isn't withdrawn, so a chain of corrections stays replaced.
   - Every record still in force in a scope must have its receipt, unchanged. If one is missing or changed, the listing
     (or `harnessChecks`) is `status_unavailable`, because that record might be the FAIL that decides the label. Lost
     evidence is never dropped quietly; to clear it, withdraw or supersede the record. A withdrawn or superseded
     record's receipt may be gone, and so may the receipt of a record that can't label. A community report whose
     receipt is gone drops out of `communityReports`, because a count isn't a label.
3. **Match.** A record applies to a configuration when its source repository and folder, configuration ID and package
   digest match the listing. A record for another package applies only through that configuration's `evidenceReuse`,
   and then the label shows both digests.
4. **Evidence kinds.**
   - Only `native-workflow` team records earn a team label.
   - `synthetic` (a test fixture), `installed-only` (a binary on disk), `daemon-adoption` and `running-seat` (version
     bindings) aren't evidence that a team ran. They're read and must be readable, but they never label, so the
     configuration reads Not tested by OpenRig.
   - `community-reported` records are counted in `communityReports` and never label.
   - Harness-check lines use every kind except `synthetic` and `community-reported`: a fixture is never evidence about
     a user's harness, and a community report isn't OpenRig's result. The on-path and version steps can rest on
     `installed-only` or `running-seat` evidence.
5. **Label.**
   - `known_problem`: a FAIL that's unresolved. A FAIL is resolved only by a record in force that names it in
     `resolves`, passes that step, and ran on the same or a newer OpenRig version (SemVer precedence:
     prereleases ordered, build metadata ignored).
   - Otherwise the best record decides: `tested` (every required step passed, with no help), `tested_with_help`
     (every required step passed, with help), `partly_tested` (some passed). A tie goes to the newest.
     - **The best record wins on purpose.** A newer partial or assisted run doesn't erase an older complete,
       unassisted pass on the same package and environment. When a newer run should replace an older one, record it
       with `supersedes`.
   - With no such record, `platforms` is empty, which means Not tested by OpenRig.
   - A harness-check line shows the newest harness-check record in force for that harness and environment.

The OpenRig version is shown, not matched: a label carries forward to later releases, dated, until new evidence
changes it. Each label carries the date, OpenRig version, record ids and package digest(s) it rests on. A Known
problem or Partly tested label also carries the deciding record's `publicNote` as `note`, when it has one.

## Wording

The site shows the labels as: Known problem, Tested by OpenRig, Tested with help (N), Partly tested,
Not tested by OpenRig, and Status unavailable.

## `bodyDigest`

`status.json` ends with `bodyDigest`, the SHA-256 of the canonical JSON (RFC 8785) of every other top-level field. A
hand edit that doesn't regenerate the file fails the registry check. The digest catches mistakes; it isn't a
signature.
