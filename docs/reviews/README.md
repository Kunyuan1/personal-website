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

75 simulated minutes across five fixed seeds, checking 14 invariants. Exits
non-zero if any fails. `--json` gives a diffable form.

This exists because the simulation cannot be reviewed by looking at it. A
browser shows a few seconds of one era, while the failures that matter only
appear over tens of minutes: worlds dying during Stable Eras, suns leaving the
frame, a cause repeating forever, an ejection crossing the screen in a single
frame. Several of those were found only because a measurement disagreed with
what the code plainly appeared to do.

Other checks worth running:

```bash
npm run check:glyphs     # every Chinese glyph is in the font subset
npx tsc --noEmit
npx eslint .
npx next build
```

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
