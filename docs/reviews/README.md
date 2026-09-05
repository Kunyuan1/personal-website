# Code reviews

Reviews of this codebase live here, one file per review, newest first in the
index below. Ask for "the latest review" or name a file and it can be picked up
from where it left off.

## Running a review

The `/code-review` command takes an effort level and a target. Prompts that are
already scoped for this project are in [`prompts.md`](./prompts.md) — the
simulation one is the important one.

After a review, save the findings here as `YYYY-MM-DD-<topic>.md` using
[`TEMPLATE.md`](./TEMPLATE.md), and add a line to the index. Keep resolved
findings in the file rather than deleting them; the record of what was tried
and rejected is the part that stops the same mistake twice, and this codebase
has already repeated one.

## Before reviewing the simulation, get fresh numbers

```bash
npm run sim:report
```

75 simulated minutes across five fixed seeds, checking 14 invariants. Exits
non-zero if any fails. `--json` for a diffable form.

This exists because the simulation cannot be reviewed by looking at it: a
browser shows a few seconds of one era, while the failures that matter only
appear over tens of minutes. **Every number in these reviews should come from
that script, not from reading the code and reasoning about it.** Several bugs
here were found only because a measurement disagreed with what the code
plainly appeared to do.

## Index

| Date | Review | Outcome |
| --- | --- | --- |
| 2026-09-05 | [Simulation baseline](./2026-09-05-simulation-baseline.md) | 14/14 invariants passing; no open findings |
