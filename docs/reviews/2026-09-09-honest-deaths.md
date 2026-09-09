# Honest deaths review — 2026-09-09

**Scope:** `src/lib/trisolaris.ts`, `scripts/simulation-report.mts`, `src/components/EraNotice.tsx`, ticket #17
**Commit:** branch `honest-deaths`
**Harness:** `npm run sim:report` — 33/33 passing

A design record rather than a review of someone else's work, kept here because
the ticket asked for one and because the sweep that chose three constants is
the part a later reader will want and cannot reconstruct.

The change came from an observation nobody in the harness could have made: the
death notices did not describe the books. If the planet falls into a sun, a
civilisation cannot carry on — and the counter carried on anyway, 61% of the
time.

## What was wrong

**Two of five causes destroyed the planet.** `fire` (28/79) and `cold` (20/79)
described Trisolaris being swallowed or thrown clear, and were followed by
`文明 #N+1`. `resetInto` then built an entirely new system on a switched
periodic solution, so civilisation 2 lived somewhere civilisation 1 had never
been. In the books there is one planet and two hundred civilisations on it; the
eleven siblings were swallowed long ago, which is history, not a thing that
happens every thirty seconds. Falling into a sun is the death of the eleven,
and `worldLost` already existed for exactly that.

**`starless` measured nothing about the world.** It fired when any sun passed
radius 6 from the centre. Measured, the home world's flux at that moment had a
median of **0.160** — inside the moth's ordinary Stable Era band of
[0.137, 0.170]. It ended civilisations standing in perfectly good light, and it
ended every world at once wherever any of them happened to be. A sun at radius
6 has not escaped either: the test is distance, not orbital energy.

## The model now

Flux on the home world, `Σ 1/d²` over the three suns, softened by the same
`PLANET_SOFTENING` the force law uses. Measured over eight pinned Stable Eras:

| orbit | home r | Stable Era flux | hi/lo |
| --- | --- | --- | --- |
| figure-eight | 3.0 | 0.3773 – 0.825 | 2.19 |
| moth | 4.6 | 0.1373 – 0.1701 | 1.24 |

The figure-eight's home world stands in **two to five times** the light the
moth's does, so thresholds are multiples of each orbit's own band. A single
absolute number would mean "balmy" on one solution and "already dead" on the
other. Both bands are in `ORBITS` as `homeFlux` and re-measured by the pinned
rig, the same arrangement `homeExcursion` got in the 2026-09-08 review.

Civilisations die of **exposure**, not position: time spent beyond a threshold,
accumulated in simulation time so a slingshot is billed for the heat it
delivered rather than the frames it took. `BURN_RADIUS` at 0.22 is a near miss,
not a collision — the suns have no radius here, and measured, the world crosses
from ~0.23 to dead inside one frame's 32 substeps — so a fast close pass is now
survivable and a slow one is not.

Trisolaris is carried across a collapse rather than ghosted, with its trail, and
the settle blends it into its place in the new configuration. That trail is the
only unbroken thing on screen across a collapse, which is what makes the
continuity legible rather than merely true.

## Three things the first implementation got wrong

Recorded because each was caught by a red invariant rather than by reading.

**Deleting `starless` let the suns leave the frame.** It was doing a second job
nobody had written down: it was the only thing that ever ended an era in which
a sun wandered off. Without it the suns drifted past 6 and `max sun radius`
went red, taking `a survivor's suns stay in frame` with it (worst x1.345). The
era now ends when the suns come apart, and that also sets `orbitWrecked` —
otherwise a survival notice could land over a frame with a sun missing from it,
which is the same lie the whole-era test was added to stop.

**`syzygy` was unreachable, then unreachable a second way.** Appended last in
`describeFates` it could never be picked, because `pickFate` takes the first
fate that is not a repeat and the lethal cause is always in front. Moved to the
front — it is strictly the more specific truth — it still never fired: the
geometric test was three suns within `SYZYGY_SPREAD` and the world within
`SYZYGY_RANGE`, which at the edge of that range delivers a flux of about 1.04
against the figure-eight's scorch threshold of 2.475. **The conjunction that
was called a tri-solar day could not scorch anyone.** Over 75 simulated minutes
`syzygyDose` never left zero.

Replaced with a test of where the heat is coming from: if no single sun supplies
more than `SYZYGY_DOMINANCE` of the flux, three of them are in the sky at once.
That is both the better test and the more literal one. `syzygy` is now 14 of 126
collapses, and `SYZYGY_SPREAD`, `SYZYGY_RANGE` and `sunSpread` are deleted.

**The ghost invariant had inverted.** It expected a collapse to retire every
standing world; a collapse now spares Trisolaris. The expression once planted
here as a *regression* — `pl.alive && !pl.isHome`, in the 2026-09-08 review — is
the shipped behaviour. The counter is `aliveBefore - 1`, and a new invariant
watches the other side of it.

## Choosing the thresholds

`SCORCH_MULTIPLE`, `FREEZE_FRACTION` and `LETHAL_EXPOSURE` are the least
physically constrained numbers in the file. Swept over the real decision path,
two stages, five seeds × 15 simulated minutes each.

Stage one, the shape of the space:

```
scorch freeze dwell | mort | scorched frozen drift syzygy | repeats
     2    0.5     1 |  73% |  29%    30%   30%    11% |  18%
     2   0.65     1 |  80% |  28%    38%   23%    11% |  12%
   2.5    0.5     1 |  73% |  30%    29%   34%     7% |  17%
     3    0.5     1 |  73% |  26%    29%   37%     8% |  18%
     3   0.65     1 |  82% |  25%    37%   31%     7% |  14%
     2    0.5   1.5 |  71% |  30%    25%   37%     9% |  20%
   2.5    0.5   1.5 |  71% |  26%    23%   43%     8% |  17%
     3    0.5   1.5 |  69% |  19%    24%   50%     7% |  23%
```

The tension is legible in that table and is worth stating plainly: **lower
mortality costs cause variety.** Make heat and cold harder to reach and more
eras end on the timeout instead, so `drift` grows — at (3, 0.5, 1.5) it is half
of all deaths and notice repetition goes red at 23%.

Stage two, narrowing where both were acceptable:

```
scorch freeze dwell | mort | scorched frozen drift syzygy | repeats
   1.8   0.55     1 |  77% |  30%    33%   26%    11% |  12%
   1.8    0.6     1 |  80% |  31%    34%   24%    11% |  11%
     2    0.5     1 |  73% |  29%    30%   30%    11% |  18%
     2   0.55     1 |  74% |  27%    36%   26%    11% |  13%   <- chosen
     2    0.6     1 |  78% |  27%    36%   26%    11% |  11%
   2.2   0.55     1 |  75% |  26%    36%   29%    10% |  14%
```

**(2, 0.55, 1)** has the lowest mortality of the low-repetition rows, the most
even spread of causes, and six points of margin under the repetition threshold
rather than one or two. Rows at 80% were rejected for sitting exactly on the
mortality invariant's ceiling, where any later change trips them.

## Mortality moved, and that is a decision

**74%, up from 66%.** Survival falls from 33% of Chaotic Eras to 24%. A
civilisation is simply easier to end than a planet is to destroy, and no
threshold in the sweep both keeps the causes varied and holds mortality where
it was. This is a question about the site rather than about the simulation, and
the harness will not answer it — recorded in `prompts.md` under the known gap so
it is not silently inherited.

## The new invariants were planted against

**Trisolaris outlives its civilisations.** `resetInto` reverted to ghosting the
home world:

```
PASS  every death leaves a ghost               158/158                              expected equal
FAIL  Trisolaris outlives its civilisations    126 collapses ghosted the home world exit 1
```

Worth keeping both: the ghost invariant passes that happily, because the home
world *was* ghosted correctly — it simply should not have been ghosted at all.
Two invariants, two different questions.

**No death without the exposure to justify it.** The dwell reduced to an
instant, `heatExposure > 0`:

```
FAIL  no death without the exposure to justify it   60 of 101   exit 1
```

**Home flux matches the table.** `homeFlux` set stale to `[0.30, 0.825]`:

```
FAIL  figure-eight: home flux matches the table   [0.3773, 0.825] vs [0.3, 0.825]   exit 1
```

## Considered and rejected

**Keeping `starless` with better wording.** Rejected on the measurement: at the
moment it fires, the home world's median flux is inside the moth's ordinary
Stable Era band. There is no wording for "this civilisation died of standing in
normal light". Flux is the thing it was failing to measure, so flux replaced it.

**Naming the tri-solar day from the geometry at the instant of death.** Rejected
because it is unreachable: the dose takes `LETHAL_EXPOSURE` to deliver and the
suns have dispersed by the time it lands. Measured at zero occurrences over 75
simulated minutes before the dominance test replaced it.

**Leaving the orbit switch alone as purely a visual device.** Kept, but not
silently: the home world now carries its position and trail across the switch
and is blended into the new configuration by the existing settle, which already
re-seeds survivors onto canonical angles for a documented reason. The
alternative — one system forever — is more literally the books but deletes the
moth from the site, and the moth is a validated solution and half the visual
variety.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415, plus 10 pinned

  PASS  closure drift: figure-eight over 2T                 0.001                                expected < 0.06
  PASS  closure drift: moth over 1T                         0.05                                 expected < 0.06
  PASS  kick smoothness (median turn vs stable)             1.53 deg vs 1.59 deg                 expected ratio < 1.6
  PASS  deaths during a Stable Era                          0                                    expected 0
  PASS  collapses without a settle                          0                                    expected 0
  PASS  every death leaves a ghost                          158/158                              expected equal
  PASS  sun trails survive a collapse                       359 points                           expected > 0
  PASS  max sun radius                                      6                                    expected <= 6
  PASS  any world while stable                              x1.034                               expected < x1.10
  PASS  worst on-screen crossing                            3.46s                                expected > 1.0s
  PASS  all four causes occur                               4                                    expected 4
  PASS  no death without the exposure to justify it         0 of 79                              expected 0
  PASS  Trisolaris outlives its civilisations               0 collapses ghosted the home world   expected 0
  PASS  consecutive notices repeating                       14/126 (11%)                         expected < 20%
  PASS  notice delay after leaving view                     mean 0.1s                            expected < 2.0s
  PASS  mortality                                           74%                                  expected 40-80%
  PASS  a survivor holds its orbit                          worst x1.296                         expected <= x1.3
  PASS  a survivor never leaves the frame                   0 frames                             expected 0
  PASS  a survivor's suns stay in frame                     worst x0.647                         expected < x1.0
  PASS  every Chaotic Era resolves                          126 died + 40 survived + 4 running   expected 170
  PASS  sun trail within its orbit's limit                  worst excess 0                       expected 0
  PASS  deaths while pinned (10 min)                        0                                    expected 0
  PASS  pinned frames outside a Stable Era                  0                                    expected 0
  PASS  figure-eight: Stable Eras measured                  8                                    expected 8
  PASS  figure-eight: every world holds its orbit           x1.025                               expected < x1.10
  PASS  figure-eight: home excursion matches the table      [x0.784, x1.003] vs [x0.784, x1.003] expected within 0.002
  PASS  figure-eight: home flux matches the table           [0.3773, 0.825] vs [0.3773, 0.825]   expected within 0.002
  PASS  figure-eight: the band admits an undisturbed orbit  room 0.084 below, 0.297 above        expected both > 0
  PASS  moth: Stable Eras measured                          8                                    expected 8
  PASS  moth: every world holds its orbit                   x1.034                               expected < x1.10
  PASS  moth: home excursion matches the table              [x0.948, x1.034] vs [x0.948, x1.034] expected within 0.002
  PASS  moth: home flux matches the table                   [0.1373, 0.1701] vs [0.1373, 0.1701] expected within 0.002
  PASS  moth: the band admits an undisturbed orbit          room 0.248 below, 0.266 above        expected both > 0

  chaotic eras 170, collapses 126, survivals 40, outer worlds lost 32
  causes {"scorched":34,"drift":33,"frozen":45,"syzygy":14}
  worst dose a civilisation survived 0.862 of the lethal exposure
  peak sun speed 11.539, slowest rate 0.301x

  home world's orbit against SURVIVABLE_BAND [0.7, 1.3]
    figure-eight  runs [x0.784, x1.003]   room 0.084 below, 0.297 above
    moth          runs [x0.948, x1.034]   room 0.248 below, 0.266 above

  peak radius per world, over 8 pinned Stable Eras each
    figure-eight
      home   r=3       0deg   peak x1.003
      world  r=3.3    72deg   peak x1.024
      world  r=3.6   144deg   peak x1
      world  r=3.9   216deg   peak x1
      world  r=4.2   288deg   peak x1.025
    moth
      home   r=4.6     0deg   peak x1.034
      world  r=5.05   90deg   peak x1.001
      world  r=5.5   180deg   peak x1
      world  r=6     270deg   peak x1

```
