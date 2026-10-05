---
node: <project | mission | slice>
intent: >-
  <ONE sentence: what this node is FOR. This composes UP the chain, so write it to be
   read from below by someone standing on a slice. Say the purpose, never the location —
   "deferred features land here" is a routing rule and orients nobody.>
id: <OPR.x.y[.n] — minted by the PM; omit if unminted>
stage: wip
# stage: wip | provisional | established | canonical | superseded | retired
status: UNSEEDED
---

<!-- ONE authored file per work node. README.md and IMPLEMENTATION-PRD.md fold into this.
     PROOF.md stays separate and is good. PROGRESS.md is the authored acceptance checklist:
     checkbox items are stored marks; every roll-up above them is derived, never hand-authored.
     Legacy README.md nodes stay valid indefinitely; nothing is forced to migrate.

     PROJECT nodes carry stable intent. MISSION nodes carry intent and proportional
     mission-level specification in this same authored file, organizing slices and
     giving them shared scope. SLICE nodes carry concrete implementation scope.
     Keep body depth proportional; do not repeat all slice details at mission level.

     WHATEVER BODY YOU DO WRITE, two tests per sentence:
       PORTABILITY — if it would read correctly on a stranger's machine it is knowledge
         about a KIND; it belongs in the operating-model skill, not on the tree.
       VOLATILITY — a SHA, a count, a status, a roster: write the COMMAND that derives it,
         never the answer. A value here is stale by the next fold.
     And check the tree: traps and how-we-work live in LEARNED.md on the topology tree,
     not here. This file is what is being BUILT.

     Follow the selected mission-slice-sop and any explicit operating-mode overlay.
     Use the required sections for that work; the generic body below is a starting
     shape, not an additional gate or a requirement for every mission. -->

# <name>

## What must be built

<!-- The change itself, at the altitude a builder can act on. -->

## Why this is the shape

<!-- The reasoning a reader would otherwise have to reconstruct — especially any option
     considered and rejected. This is the part that survives you. -->

## How we will know it works

<!-- Verified by EFFECT: run it, look at the result. Name the command and what it should
     print, not the feeling of being done. -->

## Scope fences

<!-- What this deliberately does NOT include, so it neither swallows the release nor grows
     during the build. Fences written after the fact are excuses; written now they hold. -->
