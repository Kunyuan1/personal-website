# Survival band review — 2026-09-08

**Scope:** `src/lib/trisolaris.ts`, `scripts/simulation-report.mts`, `src/components/EraNotice.tsx`, branch `survival-band`
**Commit:** ab7333e reviewed, fixes on top
**Harness:** `npm run sim:report` — 25/25 passing

Review of the branch that judges survival over the whole Chaotic Era rather
than at its final frame. The premise holds and is well evidenced: a third of
survivals under the old test had left the frame entirely, one passing within
0.002 of its own radius of the suns before coming back, and the notice
contradicted the animation it described. Latching the band fixes that.

Four findings. Two fixed here; two are design calls on numbers this review
should not make unilaterally, and are left open with their measurements.

## Findings

### 1. The ghost invariant could not see a missing home-world ghost — fixed

**Where:** `scripts/simulation-report.mts:206`

**What goes wrong:** the rewritten check compared new ghosts against the number
of *death events* in the frame. A collapse retires every world still standing,
so a collapse frame creates roughly five ghosts against one `collapse` event —
four worlds of slack, on exactly the frame that matters. A home world that was
never ghosted was covered several times over by its neighbours.

This is invariant 3, whose stated purpose is that Trisolaris and its trail
never blink out of existence between two frames. It is also the invariant this
branch was rewriting because the *previous* version could not tell one death
from two.

**Evidence:** planted the regression it exists to catch — `resetInto` carrying
`pl.alive && !pl.isHome`, so the home world is never ghosted on any collapse:

```
PASS  every death leaves a ghost    156/156    expected equal      exit 0
```

Zero failures, whole run green, with the home world blinking out on every
collapse in the branch.

**Resolution:** counted against the worlds that actually stopped being alive —
the whole standing population on a collapse frame, and the alive-to-dead delta
otherwise — rather than against event counts. The same planted regression now
reads:

```
FAIL  every death leaves a ghost    50/156     expected equal      exit 1
```

### 2. Figure-eight civilisations are 95% fatal; moth ones 50% — open

**Where:** `src/lib/trisolaris.ts:164`, `SURVIVABLE_BAND`

**What goes wrong:** the 66% mortality the branch is tuned to is the average of
two very different games. Split by periodic solution it is 95% and 50%, and on
the figure-eight, surviving is the rounding error this change set out to
remove.

`orbitForCivilization` alternates by parity and civilisation 1 is always the
figure-eight, so a first-time visitor is near-certain to watch civilisation 1
die at its first Chaotic Era, and the `survived` notice added by #6 is
effectively unreachable on every odd civilisation.

**Evidence:** five report seeds, 15 minutes each.

```
figure-eight   54/57  died (95%)
moth           52/103 died (50%)
```

The floor is what does it, not the ceiling — 33 of 45 figure-eight wreckings
are crossings of `SURVIVABLE_BAND[0]`. The file's own comment records the
figure-eight home world dipping to x0.784 of its radius during an *undisturbed*
Stable Era: 12% of headroom above the x0.7 floor, against the moth's x0.948,
which has 35%. A single band cannot mean the same thing to two orbits whose
natural eccentricity differs that much.

**Resolution:** left open. A per-orbit band, or a floor derived from each
orbit's measured Stable Era minimum, would even this out — but both move every
number in the report, and which mortality the site *wants* is not a call this
review should make. Worth noting the table already carries per-world measured
peaks, so the provenance for a derived floor exists.

### 3. `drift` is now the majority cause, and the repeat guard is two points from failing — open

**Where:** `src/lib/trisolaris.ts:913`

**What goes wrong:** `describeFates` appends `drift` whenever `orbitWrecked` is
set, and in the timeout branch `fatesOf` is frequently empty, leaving `["drift"]`
as the only candidate `pickFate` can return. The file's design note is explicit
that drift is a *description*, never a cause of death — something for `pickFate`
to reach for instead of repeating itself. It is now the headline.

**Evidence:**

```
main          drift 17/79   (22%)
survival-band drift 57/106  (54%)
```

Measured longest run of consecutive `drift` notices: **4**. A visitor reads
"The orbit never recovered. The civilization dehydrated, and did not wake."
four times in a row. The invariant that would catch this reads 19/106 (18%)
against `< 20%`, up from 14% — so the next change that moves mortality at all
trips it for reasons unrelated to that change.

**Resolution:** left open, and tied to finding 2 — most of the drift share is
the figure-eight dying on the floor, so evening the band out would move this
number too. Fixing it here by reordering `pickFate` would only relabel deaths
that genuinely are drift.

### 4. Stale survival figure — fixed

**Where:** `src/lib/trisolaris.ts:355`, `src/components/EraNotice.tsx:12`

**What goes wrong:** both were updated 43% -> 34%. The harness measures 52
survivals against 158 resolved Chaotic Eras: 52/158 = 32.9%, 52/160 = 32.5%.
Both round to 33%.

Stale figures in exactly this position were finding 5 of the 2026-09-07 review.
The number is load-bearing for the next reviewer diffing against it.

**Resolution:** both corrected to 33%.

## Considered and rejected

**Reading the survivor invariants as vacuous.** `a survivor holds its orbit`
and `a survivor never leaves the frame` cannot fail while the latch is in
place: the harness samples a subset of the frames the simulation itself
checks, and for both orbits `SURVIVABLE_BAND[1] * home` is inside the frame
extent (3.9 against 4.45, 5.98 against 6.36). They are guards against the latch
being *removed*, which is the right thing to guard, so they stay.

**A stale `orbitWrecked` leaking into a Stable Era.** The flag is only ever set
under `sys.era === "chaotic"`, and every exit from a Chaotic Era clears it —
`destabilise` on the way in, and `resetInto` through `createSystem` on a
collapse. Instrumented over 75 simulated minutes: **0 frames** with
`orbitWrecked` true while settled and stable. Not a finding.

**The latch turning every doomed era into a countdown**, which is the failure
mode the commit message cites for `CHAOS_MAX = 18`. Measured the fraction of
each doomed era already decided when the flag latched: median 0.73, **0 of 91**
decided in the first quarter, mean 3.7s of real time spent on an era whose
outcome was already fixed. The concern does not hold at these constants.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415, plus 10 pinned

  PASS  closure drift: figure-eight over 2T        0.001                              expected < 0.06
  PASS  closure drift: moth over 1T                0.05                               expected < 0.06
  PASS  kick smoothness (median turn vs stable)    1.53 deg vs 1.59 deg               expected ratio < 1.6
  PASS  deaths during a Stable Era                 0                                  expected 0
  PASS  collapses without a settle                 0                                  expected 0
  PASS  every death leaves a ghost                 156/156                            expected equal
  PASS  sun trails survive a collapse              359 points                         expected > 0
  PASS  max sun radius                             6                                  expected <= 6
  PASS  any world while stable                     x1.034                             expected < x1.10
  PASS  worst on-screen crossing                   3.46s                              expected > 1.0s
  PASS  all five causes occur                      5                                  expected 5
  PASS  consecutive notices repeating              19/106 (18%)                       expected < 20%
  PASS  notice delay after leaving view            mean 0.3s                          expected < 2.0s
  PASS  mortality                                  66%                                expected 40-80%
  PASS  a survivor holds its orbit                 worst x1.296                       expected <= x1.3
  PASS  a survivor never leaves the frame          0 frames                           expected 0
  PASS  a survivor's suns stay in frame            worst x0.73                        expected < x1.0
  PASS  every Chaotic Era resolves                 106 died + 52 survived + 2 running expected 160
  PASS  sun trail within its orbit's limit         worst excess 0                     expected 0
  PASS  deaths while pinned (10 min)               0                                  expected 0
  PASS  pinned frames outside a Stable Era         0                                  expected 0
  PASS  figure-eight: Stable Eras measured         8                                  expected 8
  PASS  figure-eight: every world holds its orbit  x1.025                             expected < x1.10
  PASS  moth: Stable Eras measured                 8                                  expected 8
  PASS  moth: every world holds its orbit          x1.034                             expected < x1.10

  chaotic eras 160, collapses 106, survivals 52, outer worlds lost 50
  causes {"drift":57,"fire":25,"cold":14,"syzygy":3,"starless":7}
  peak sun speed 11.934, slowest rate 0.315x

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
