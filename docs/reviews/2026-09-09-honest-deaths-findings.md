# Honest deaths — review findings — 2026-09-09

**Scope:** `main...honest-deaths` (6 files, +639/-71) — the review of the branch
recorded in [Honest deaths](./2026-09-09-honest-deaths.md), which is that
branch's own design record. This file is the review of it.
**Commit:** branch `honest-deaths`
**Harness:** `npm run sim:report` — 37/37 passing, up from 33/33

Eight findings, all fixed. Two of them were the branch's own standard applied to
the branch: it deleted `starless` for ending civilisations that stood in
perfectly good light, then shipped a path that ended civilisations standing on
perfectly good orbits, and an audit a mislabelled death could escape by being
mislabelled.

Four invariants are new and two are strengthened. Every one of them is red with
its fix removed, with the numbers below.

## Findings

### 1. The carried home trail overran the new orbit's limit, permanently — fixed

**Where:** `src/lib/trisolaris.ts`, `resetInto`

**What goes wrong:** `resetInto` copied `survivingHome.trail` across a collapse,
and a collapse also switches solution — `planetTrailLength` is 691 on the moth
against 364 on the figure-eight. `recordTrails` could not drain the excess:
`push` +1, `shift` -1 nets zero, so the home world kept a trail nearly twice as
long as its orbit for the whole of the next civilisation. This is the one thing
the branch calls the point of the change — the trail is the only unbroken thing
on screen across a collapse — and it was unbroken and twice too long.

**Evidence:** worst excess **327 points (691 vs 364, 90% over)** over the report
seeds, and over its limit for **83,825 of 270,000 frames — 31% of the run**. On
`main` it is 0/270,000. The harness stayed green because
`sun trail within its orbit's limit` had no counterpart for the worlds — the sun
path six lines above documents this exact failure and fixes it with a `slice()`;
the home world got the copy and not the cut.

**Resolution:** `trail: survivingHome.trail.slice(-sys.planetTrailLength)`, and
`recordTrails` now splices down to the limit rather than dropping one point, the
same way `recordSunTrails` does. New invariant
`world trail within its orbit's limit`. Planted against, by restoring the plain
`slice()`:

```
FAIL  world trail within its orbit's limit    worst excess 327    expected 0    exit 1
```

### 2. A wandering sun was still unconditionally lethal — fixed

**Where:** `src/lib/trisolaris.ts`, the Chaotic Era terminator

**What goes wrong:** the era ended when a sun passed `SUN_ESCAPE_RADIUS`, and the
same condition set `orbitWrecked`. With the flag set by the terminator itself the
survival branch was unreachable on that path by construction — while the comment
three lines above said the opposite: *"If neither condemns it, a sun wandering
off is something it lives through."*

**Evidence:** **5 of 5** suns-came-apart eras collapsed, 0 survived. Two of them:

```
seed 99:    cause=drift  home at x1.067 of its orbit  heat=0.00  cold=0.06
seed 31415: cause=drift  home at x1.051 of its orbit  heat=0.00  cold=0.91
```

Both inside `SURVIVABLE_BAND` with no exposure worth the name, both shown *"The
orbit never recovered. The civilization dehydrated, and did not wake."*

**Resolution:** the terminator ends the era and decides nothing. Measured after:
**4 such eras, 2 survive and 2 die** — and the two deaths are at x0.220 and
x1.334 of their own radius, outside the band on their own account. The two
survivors are the seeds quoted above.

What justified the flag was that a survival notice must not land over a frame
with a sun missing from it. That is now asserted rather than bought: it holds at
worst **x0.942**, and it is the invariant's job to notice if it stops. On the
moth the sun bound sits inside the frame (6 against 6.36) so the case cannot
arise; on the figure-eight the frame is 4.452 and a sun leaves it in **6 of 66**
eras, all 6 of which die of exposure or the band regardless. See *Considered and
rejected* for why the bound was not moved to the frame instead.

### 3. `syzygy` was prepended to deaths that were not heat deaths — fixed

**Where:** `src/lib/trisolaris.ts`, `describeFates`

**What goes wrong:** `syzygyDose` only accumulates inside the heat branch, so it
is a share of the *heat* dose — but the conjunction test was applied to whatever
`lethal` happened to contain. Cook a world under a conjunction to
`syzygyDose >= 0.5` with heat still sub-lethal, then fling it outward until
`coldExposure` reaches 1, and `fates` is `["syzygy", "frozen"]` with `syzygy`
picked first. The visitor reads *"All three suns rose at once"* about a
civilisation that froze to death. The same path renamed timeouts.

**Evidence:** **1 of 14** syzygy notices, and it breaks `pickFate`'s stated
contract that the notice never claims something that didn't happen.

**Resolution:** `conjunction` now requires `lethal.includes("scorched")`.
`syzygy` is 12 of 124 collapses, from 14 of 126. Planted against by removing the
guard, and caught by the widened audit of finding 4:

```
FAIL  no death without the exposure to justify it    1 of 124    expected 0    exit 1
```

### 4. The exposure invariant was blind where the bug was — fixed

**Where:** `scripts/simulation-report.mts`, the collapse handler

**What goes wrong:** the audit ran only for `scorched` and `frozen` — 79 of 126
collapses. And because `describeFates` puts `syzygy` *in front of* the lethal
cause, relabelling a death as `syzygy` lifted it out of the audited set. An
invariant a mislabel can escape by being mislabelled is not holding the line:
finding 3 lived inside it while the row printed `0 of 79` and passed.

**Evidence:** the pre-fix run prints `0 of 79` with the finding-3 mislabel
present. The same mislabel is now `1 of 124`, and exits 1.

**Resolution:** every collapse is audited. `scorched` and `frozen` answer for
their dose; `syzygy` answers for both — the heat must have been lethal *and*
mostly taken with three suns in the sky; `drift` answers for the latch, or for
where the world ended up, since the flag can be set and the era ended inside one
frame but a collapse carries the home world across at the position it died at.
Now `0 of 124`.

### 5. The notice-delay invariant asserted the mean, and hid a regression — fixed

**Where:** `scripts/simulation-report.mts`, `notice delay after leaving view`

**What goes wrong:** killing the home world on accumulated `coldExposure`
instead of instantly at `escapeRadiusFor` let it drift off screen for up to
`LETHAL_EXPOSURE` of sim time before its notice landed. The row asserted the
mean, which improved:

| | mean | p90 | max |
| --- | --- | --- | --- |
| `main` | 0.30s | 1.57s | 2.50s |
| this branch, before the fix | **0.10s** | 0.03s | **3.52s** |

The mean improved 3x and the row reported a win; the worst case regressed 40%
and went past the row's own 2.0s threshold on the way. The `ESCAPE_FACTOR` doc
names this exact failure and quotes a max, not a mean.

**Resolution:** the row asserts the max and prints the mean and p90 beside it.
The delay itself is gone rather than merely visible: a Chaotic Era now ends when
the home world leaves the frame (finding 6), so the notice lands in the frame the
crossing happened in — **max 0s**. Planted against by disabling that terminator:

```
FAIL  notice delay after leaving view    max 3.52s (mean 0.12s, p90 0.07s)    expected max < 2.0s
FAIL  the home world stays in the frame  worst x1.433                         expected < x1.02
```

The mean-only row would have passed that first line.

### 6. Trisolaris passed through the drawn disc of a sun, and past its own frame — fixed, in part accepted

**Where:** `src/lib/trisolaris.ts`, `isDestroyed` and `BURN_RADIUS`

**What goes wrong:** two things, and they part company.

The frame half is a plain gap: the suns had `SUN_ESCAPE_RADIUS`, survivors had
`SURVIVABLE_BAND`, and the home world of a civilisation about to die had neither.
It reached **6.44** — past the moth's own visible extent of 6.36.

The drawn half is that *"the suns have no radius here"* is true of the physics
and false of the canvas, where a sun is a 4.4px core inside a 34px corona.

**Evidence:** the home world comes within **0.0098 world units** of a sun's
centre — **0.6px** at a 1600x900 hero, well inside the core — and spends **148
frames** inside `BURN_RADIUS` over 75 simulated minutes. Without a frame bound it
reaches **x1.433** of the frame it is drawn in.

**Resolution:** the frame half is fixed. A Chaotic Era ends when the home world
leaves the frame, `frameRadiusFor` is one exported function that `SystemCanvas`,
the harness and the simulation all read, and `the home world stays in the frame`
asserts it at worst **x1.003**. This terminator decides no fates: the frame edge
lies outside the top of the band on both solutions — asserted per orbit, so a
future solution placed with its frame inside the band cannot turn it into an
unannounced cause of death — so `orbitWrecked` is already set by the time it can
fire. Measured, 14 of 124 collapses end this way and **none of them survived**;
mortality moved 74% -> 73%.

The drawn half is accepted, with the reasoning written next to `isDestroyed`
rather than left as a claim the next reader can measure and find false. See
*Considered and rejected*.

### 7. The review index was out of date order — fixed

**Where:** `docs/reviews/README.md`

The `2026-09-09` row was inserted above `2026-09-08` in a strictly date-ordered
table, so anything appending the next review to the end would compound the
break. Moved below it.

### 8. Two consecutive JSDoc blocks above `FATES` — fixed

**Where:** `src/components/EraNotice.tsx`

Tooling binds the later block and drops the first, so the survival-rate
rationale was unreachable from the symbol it documented. The Chaotic Era block
now sits on the component, where what it describes actually lives, and `FATES`
keeps the block about the fates. Its 24% is 25% on the current run.

## Considered and rejected

**Ending the era when a sun leaves the *frame*, rather than at
`SUN_ESCAPE_RADIUS`.** This would make finding 2's fix true by construction:
"the suns came apart" and "a sun is off screen" would be the same event, so not
condemning the civilisation could never put a survival notice over a missing sun.
Rejected on the measurement. The two solutions are framed very differently — the
moth's frame is 6.36 and already contains the sun bound of 6, while the
figure-eight's is 4.452 — so the change bites on one solution only: **6 of 66**
figure-eight eras would end early against **0 of 100** on the moth. That
re-tunes era length asymmetrically and invalidates the sweep the three thresholds
were chosen on, to buy a guarantee the harness already measures as holding at
x0.942, in eras that all died of exposure or the band on their own account.

**A survivable-pass floor for the drawn disc of a sun (finding 6).** Rejected
from both ends. A floor loose enough to catch the measured pass is `BURN_RADIUS`,
which is the instant-death model exposure replaced — reinstating it makes a fast
slingshot indistinguishable from falling in again. A floor tight enough to mean
"inside the drawn core" is a *pixel* radius that moves with the hero's size:
0.051 world units on the figure-eight against 0.068 on the moth at 1600x900, and
different again at every other width, so there is no honest world-unit constant
to write down. What the canvas does have is additive blending with the suns drawn
over the worlds, so inside the corona the world is swamped rather than drawn as a
disc on top of a star: what is on screen is a world going in and coming out,
which is what the physics says happened.

**Rewriting the branch's sweep tables.** Left alone. They are a record of a
measurement made at a particular commit, and the two-stage table is what a later
reader needs in order to reproduce the choice. The current numbers live here
instead, and the claims in that file which these fixes falsified are corrected in
place.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415, plus 10 pinned

  PASS  closure drift: figure-eight over 2T                 0.001                                expected < 0.06
  PASS  closure drift: moth over 1T                         0.05                                 expected < 0.06
  PASS  kick smoothness (median turn vs stable)             1.53 deg vs 1.59 deg                 expected ratio < 1.6
  PASS  deaths during a Stable Era                          0                                    expected 0
  PASS  collapses without a settle                          0                                    expected 0
  PASS  every death leaves a ghost                          151/151                              expected equal
  PASS  sun trails survive a collapse                       359 points                           expected > 0
  PASS  max sun radius                                      6.005                                expected <= 6
  PASS  any world while stable                              x1.034                               expected < x1.10
  PASS  worst on-screen crossing                            3.46s                                expected > 1.0s
  PASS  all four causes occur                               4                                    expected 4
  PASS  no death without the exposure to justify it         0 of 124                             expected 0
  PASS  Trisolaris outlives its civilisations               0 collapses ghosted the home world   expected 0
  PASS  consecutive notices repeating                       18/124 (15%)                         expected < 20%
  PASS  notice delay after leaving view                     max 0s (mean 0s, p90 0s)             expected max < 2.0s
  PASS  mortality                                           73%                                  expected 40-80%
  PASS  a survivor holds its orbit                          worst x1.296                         expected <= x1.3
  PASS  a survivor never leaves the frame                   0 frames                             expected 0
  PASS  a survivor's suns stay in frame                     worst x0.942                         expected < x1.0
  PASS  the home world stays in the frame                   worst x1.003                         expected < x1.02
  PASS  every Chaotic Era resolves                          124 died + 42 survived + 3 running   expected 169
  PASS  sun trail within its orbit's limit                  worst excess 0                       expected 0
  PASS  world trail within its orbit's limit                worst excess 0                       expected 0
  PASS  deaths while pinned (10 min)                        0                                    expected 0
  PASS  pinned frames outside a Stable Era                  0                                    expected 0
  PASS  figure-eight: Stable Eras measured                  8                                    expected 8
  PASS  figure-eight: every world holds its orbit           x1.025                               expected < x1.10
  PASS  figure-eight: home excursion matches the table      [x0.784, x1.003] vs [x0.784, x1.003] expected within 0.002
  PASS  figure-eight: home flux matches the table           [0.3773, 0.825] vs [0.3773, 0.825]   expected within 0.002
  PASS  figure-eight: the band admits an undisturbed orbit  room 0.084 below, 0.297 above        expected both > 0
  PASS  figure-eight: the frame edge is outside the band    frame 4.452 vs band top 3.9          expected > 0
  PASS  moth: Stable Eras measured                          8                                    expected 8
  PASS  moth: every world holds its orbit                   x1.034                               expected < x1.10
  PASS  moth: home excursion matches the table              [x0.948, x1.034] vs [x0.948, x1.034] expected within 0.002
  PASS  moth: home flux matches the table                   [0.1373, 0.1701] vs [0.1373, 0.1701] expected within 0.002
  PASS  moth: the band admits an undisturbed orbit          room 0.248 below, 0.266 above        expected both > 0
  PASS  moth: the frame edge is outside the band            frame 6.36 vs band top 5.98          expected > 0

  chaotic eras 169, collapses 124, survivals 42, outer worlds lost 27
  causes {"scorched":32,"drift":40,"frozen":40,"syzygy":12}
  worst dose a civilisation survived 0.916 of the lethal exposure
  peak sun speed 11.539, slowest rate 0.301x
```
