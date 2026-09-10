# Code reviews

Reviews of this codebase live here, one file per review, indexed below. Ask for
"the latest review" or name a file and it can be picked up from where it left
off.

## How to run one

1. Open a **new chat in this repository**. A fresh session has none of the
   history that produced this code, which is why the prompts are written to be
   self-contained.
2. Copy a prompt from [`prompts.md`](./prompts.md) — the whole block, including
   the `/code-review` line at the top. The simulation one is the important one.
3. Paste and send.

The prompt tells the reviewer to run the test harness first, review against its
numbers rather than against a reading of the code, and write its findings to a
file here. **That last part only happens because the prompt says so** — the
`/code-review` command does not save anything on its own.

Review files are named `YYYY-MM-DD-<topic>.md` and follow
[`TEMPLATE.md`](./TEMPLATE.md).

## Before reviewing the simulation, get fresh numbers

```bash
npm run sim:report
```

75 simulated minutes across five fixed seeds, a 10-minute pinned run, and eight
pinned Stable Eras per periodic solution, checking 22 invariants. Exits non-zero
if any fails. `--json` gives a diffable form. The per-world peak radii it prints
are the provenance of every entry in the `ORBITS` table.

This exists because the simulation cannot be reviewed by looking at it. A
browser shows a few seconds of one era, while the failures that matter only
appear over tens of minutes: worlds dying during Stable Eras, suns leaving the
frame, a cause repeating forever, an ejection crossing the screen in a single
frame. Several of those were found only because a measurement disagreed with
what the code plainly appeared to do.

Other checks worth running:

```bash
npm run check:glyphs     # every Chinese glyph is in the font subset
npx next typegen         # tsc needs this on a fresh clone — see below
npx tsc --noEmit
npx eslint .
npx next build
```

`next typegen` first, and only `tsc` needs it. `next-env.d.ts` and
`.next/types` are generated and both gitignored, so on a checkout that has
never been built there are no declarations for image imports and no
`LayoutProps`: `tsc --noEmit` reports 14 errors that are not real. It has only
ever passed because every machine anyone ran it on had already run `next dev`.
Running `next build` first works too — it generates the same types — but
typegen is seconds rather than a full build.

## Keeping resolved findings

Do not delete findings once they are fixed — mark them resolved. The
"considered and rejected" section of each review is the part that earns the
file its place: it records what was tried and the measurement that ruled it
out. This codebase has already repeated one wrong turn, and that section is
what stops the next.

## Index

| Date | Review | Outcome |
| --- | --- | --- |
| 2026-09-05 | [Simulation baseline](./2026-09-05-simulation-baseline.md) | 14/14 invariants passing; no open findings |
| 2026-09-05 | [Simulation](./2026-09-05-simulation.md) | All 6 findings fixed; harness now 17/17, with the original 14 unchanged; plus a `syzygy` reproduction (seed 2 @ 84.3s) |
| 2026-09-06 | [More worlds](./2026-09-06-more-worlds.md) | All 5 findings fixed; harness now 21/21, and every world in `ORBITS` is measured rather than just Trisolaris |
| 2026-09-07 | [Survival notice](./2026-09-07-survival-notice.md) | All 5 findings fixed; harness now 22/22, and `tsc` covers `scripts/` for the first time |
| 2026-09-08 | [Survival band](./2026-09-08-survival-band.md) | 2 of 4 fixed, and **2 of the findings were themselves wrong** — the figure-eight/moth mortality split survives the band being removed (70% vs 12%), so it is geometry, not the band; and `drift` at 54% is the latch working, not a broken design note. Harness now 29/29, with the ghost invariant and two new ones planted against |
| 2026-09-09 | [Honest deaths](./2026-09-09-honest-deaths.md) | Insolation replaces distance; `starless` deleted as measuring nothing; Trisolaris outlives its civilisations. Harness now 33/33, thresholds chosen by a two-stage sweep, mortality 66% -> 74% |
| 2026-09-09 | [Honest deaths — review findings](./2026-09-09-honest-deaths-findings.md) | All 8 findings fixed. Two lies removed: a carried trail 90% over its limit for a third of the run, and a wandering sun condemning civilisations that were standing on their own orbits. Harness now 37/37, mortality 73%, and the exposure audit covers every collapse rather than 79 of 126 |
| 2026-09-09 | [The settle arrives](./2026-09-09-smooth-settle.md) | Both teleports at the end of a Chaotic Era removed — the blend now converges instead of being force-assigned, and the survival path lets the settle place its worlds rather than teleporting them 11.531 units and wiping 168 trails. Harness now 41/41, and it measures motion for the first time; every downstream number unmoved. Seven review findings fixed on top, including a renderer bug that had been masking the worst of the two cuts |
| 2026-09-10 | [The fleet departs](./2026-09-10-the-fleet-departs.md) | Trisolaris can finally be lost, to unbound escape rather than a collision — measured at zero occurrences over 150 simulated minutes, since the scorching always arrives first. Gated at civilisation 50, and the ending persists as a fact rather than a state, so it is never what a returning visitor lands on. Harness now 42/42 |
