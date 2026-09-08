# Survival band review — 2026-09-08

**Scope:** `src/lib/trisolaris.ts`, `scripts/simulation-report.mts`, `src/components/EraNotice.tsx`, branch `survival-band`
**Commit:** ab7333e reviewed, fixes on top
**Harness:** `npm run sim:report` — 29/29 passing

Review of the branch that judges survival over the whole Chaotic Era rather
than at its final frame. The premise holds and is well evidenced: a third of
survivals under the old test had left the frame entirely, one passing within
0.002 of its own radius of the suns before coming back, and the notice
contradicted the animation it described. Latching the band fixes that.

Four findings. Two were defects and are fixed. **Two were wrong** — the
observations are real and reproduce, but the mechanism this review attributed
them to does not survive being measured, and the fix it proposed made the site
worse. Both are recorded below with what actually causes them, and the rejected
fix is in "considered and rejected" with its numbers.

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

### 2. Mortality is 95% on the figure-eight and 51% on the moth — reclassified; the cause is not the band

**Where:** `src/lib/trisolaris.ts:164`, `SURVIVABLE_BAND`

**The observation, confirmed twice.** The 66% this branch is tuned to is the
average of two very different games. Re-measured with outcomes attributed by
civilisation number rather than by reading `sys.orbit` around an event — a pure
function of the civilisation, so it cannot be skewed by `resetInto` having
already switched orbit:

```
figure-eight   54/ 56 died (96%)
moth           52/102 died (51%)
```

`orbitForCivilization` alternates by parity and civilisation 1 is always the
figure-eight, so a first-time visitor is near-certain to watch civilisation 1
die at its first Chaotic Era, and the `survived` notice added by #6 is
effectively unreachable on every odd civilisation. That part stands.

**What this review got wrong.** It attributed the split to the band's floor:
the figure-eight keeps 0.084 of room below its natural minimum against the
moth's 0.248, and 33 of 45 figure-eight wreckings are floor crossings. Both
numbers are correct and neither is the cause. Widen the margin until the band
is effectively gone — the home world can reach the cold radius before its orbit
is called lost — and the split is still there:

```
band effectively disabled
  figure-eight   19/ 27 died (70%)   fire 14, cold 4, starless 1
  moth           15/125 died (12%)   fire 11, syzygy 2, starless 2
```

A 58-point spread with the band gone. The figure-eight holds its worlds from
3.0 outward while the suns roam to 6, so they burn; the moth holds its from 4.6
and they do not. The band amplifies both — and in absolute terms it costs the
*moth* more (12% to 51%) than the figure-eight (70% to 95%). The floor-crossing
statistic measured which side of the band a wrecked orbit left by, which is not
the same question as what kills civilisations.

**Resolution:** the band is left as it is, and its comment now says all of this
rather than implying the shape is neutral between the two solutions. The lever
for this asymmetry is world radii or a per-orbit `CHAOS_MAX`, not the band; the
`ORBITS` comment already records that inward of 3.0 does not survive and that
extending outward crowds the suns, so there is little room in the first of
those.

Two invariants were added rather than leaving it all to prose. `homeExcursion`
is now written in the table and re-measured by the pinned rig, and the band is
asserted to admit each orbit's undisturbed range with room on both sides. The
report prints that room per solution, so the inequality is a number in the
output instead of a fact you have to already know.

### 3. `drift` is 54% of reported causes — reclassified; not a defect

**Where:** `src/lib/trisolaris.ts:913`

**The observation, confirmed.** Cause share moves from drift 17/79 (22%) on
`main` to 57/106 (54%) here, and the longest run of consecutive `drift` notices
is 4 — a visitor reads "The orbit never recovered. The civilization dehydrated,
and did not wake." four times running.

**What this review got wrong.** It cited the design note that drift is "a
description, never a cause of death" as though this branch had broken it. That
note is about `fatesOf`, and specifically about making drift kill a world *the
moment it wanders* — measured once at 104 deaths in 119. This branch does not do
that: a wrecked orbit is not lethal in `fatesOf`, it decides the outcome when
the era's clock runs out. And `main` already reported drift for timeout deaths —
its timeout branch passes `[...fatesOf(home, sys), "drift"]` explicitly.

So the share did not rise because drift became lethal. It rose because the latch
makes more eras end as timeouts, which is the entire purpose of the branch. Per
orbit, drift is 47 of the moth's 57 deaths and 18 of the figure-eight's 60: it
is mostly the moth running out of clock, which is the honest description of what
happened to it.

**Resolution:** no change. What is worth keeping from the finding is narrower —
the `consecutive notices repeating` invariant now reads 19/106 (18%) against a
`< 20%` threshold, up from 14%, so the next change that moves mortality at all
may trip it for reasons unrelated to that change. Recorded here rather than
papered over by widening the threshold.

### 4. Stale survival figure — fixed

**Where:** `src/lib/trisolaris.ts:355`, `src/components/EraNotice.tsx:12`

**What goes wrong:** both were updated 43% -> 34%. The harness measures 52
survivals against 158 resolved Chaotic Eras: 52/158 = 32.9%, 52/160 = 32.5%.
Both round to 33%.

Stale figures in exactly this position were finding 5 of the 2026-09-07 review.
The number is load-bearing for the next reviewer diffing against it.

**Resolution:** both corrected to 33%.

## Considered and rejected

**A margin around each orbit's own excursion, replacing the fixed band.** This
was finding 2's proposed fix, and measuring it is what reclassified the finding.
`SURVIVABLE_BAND` is documented as the fraction of its own orbit the home world
must hold, but it is applied to `worlds[0].r`, the radius the world is *placed*
at — and the figure-eight is placed at essentially its apoapsis, so the
tolerance is measured from one end of the ellipse. Replacing it with
`homeExcursion` plus one shared margin makes the tolerance mean the same thing
to both solutions. Implemented, then swept over the real decision path:

```
margin | overall | fig-8 | moth | spread | drift% | repeats%
 0.090 |     90% |   97% |  84% |    13pt |    60% |      25%
 0.135 |     79% |   96% |  67% |    29pt |    61% |      25%
 0.180 |     74% |   95% |  59% |    36pt |    56% |      20%
 0.225 |     71% |   95% |  56% |    39pt |    58% |      22%
 0.270 |     65% |   90% |  51% |    39pt |    53% |      15%
```

It does not work. The figure-eight never drops below 90% at any margin, because
the band was not what was killing it; the spread does not close; and the shipped
margin of 0.18 moved overall mortality from 66% to 74% by making the *moth*
worse. The only margins that help the figure-eight at all let its home world
fall to about 1.5 units on a frame reaching 4.45 — halfway to the middle of the
system — which stops reading as an orbit held at all. Bounding the absolute
excursion, which the fixed band does, is the thing worth keeping. Reverted
whole; `homeExcursion` was kept only because it makes three comments assertable.

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

**Reading the survivor invariants as vacuous.** `a survivor holds its orbit`
and `a survivor never leaves the frame` cannot fail while the latch is in
place: the harness samples a subset of the frames the simulation itself checks,
and for both orbits `SURVIVABLE_BAND[1] * home` is inside the frame extent (3.9
against 4.45, 5.98 against 6.36). They are guards against the latch being
*removed*, which is the right thing to guard, so they stay.

## The new invariants were planted against

Neither was trusted to be able to fail.

**A stale table.** `homeExcursion` set to `[0.75, 1.003]`:

```
FAIL  figure-eight: home excursion matches the table   [x0.784, x1.003] vs [x0.75, x1.003]   exit 1
```

**A band that makes survival impossible.** `SURVIVABLE_BAND`'s floor raised to
0.8, above the figure-eight's own natural minimum of 0.784, so no figure-eight
civilisation can ever hold its orbit:

```
PASS  mortality                                            71%                             expected 40-80%
FAIL  figure-eight: the band admits an undisturbed orbit   room -0.016 below, 0.297 above   exit 1
```

`mortality` passes that happily, which is the point: without the new invariant,
a band that had made half the site's civilisations unsurvivable would be
reported as physics.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415, plus 10 pinned

  PASS  closure drift: figure-eight over 2T                 0.001                                expected < 0.06
  PASS  closure drift: moth over 1T                         0.05                                 expected < 0.06
  PASS  kick smoothness (median turn vs stable)             1.53 deg vs 1.59 deg                 expected ratio < 1.6
  PASS  deaths during a Stable Era                          0                                    expected 0
  PASS  collapses without a settle                          0                                    expected 0
  PASS  every death leaves a ghost                          156/156                              expected equal
  PASS  sun trails survive a collapse                       359 points                           expected > 0
  PASS  max sun radius                                      6                                    expected <= 6
  PASS  any world while stable                              x1.034                               expected < x1.10
  PASS  worst on-screen crossing                            3.46s                                expected > 1.0s
  PASS  all five causes occur                               5                                    expected 5
  PASS  consecutive notices repeating                       19/106 (18%)                         expected < 20%
  PASS  notice delay after leaving view                     mean 0.3s                            expected < 2.0s
  PASS  mortality                                           66%                                  expected 40-80%
  PASS  a survivor holds its orbit                          worst x1.296                         expected <= x1.3
  PASS  a survivor never leaves the frame                   0 frames                             expected 0
  PASS  a survivor's suns stay in frame                     worst x0.73                          expected < x1.0
  PASS  every Chaotic Era resolves                          106 died + 52 survived + 2 running   expected 160
  PASS  sun trail within its orbit's limit                  worst excess 0                       expected 0
  PASS  deaths while pinned (10 min)                        0                                    expected 0
  PASS  pinned frames outside a Stable Era                  0                                    expected 0
  PASS  figure-eight: Stable Eras measured                  8                                    expected 8
  PASS  figure-eight: every world holds its orbit           x1.025                               expected < x1.10
  PASS  figure-eight: home excursion matches the table      [x0.784, x1.003] vs [x0.784, x1.003] expected within 0.002
  PASS  figure-eight: the band admits an undisturbed orbit  room 0.084 below, 0.297 above        expected both > 0
  PASS  moth: Stable Eras measured                          8                                    expected 8
  PASS  moth: every world holds its orbit                   x1.034                               expected < x1.10
  PASS  moth: home excursion matches the table              [x0.948, x1.034] vs [x0.948, x1.034] expected within 0.002
  PASS  moth: the band admits an undisturbed orbit          room 0.248 below, 0.266 above        expected both > 0

  chaotic eras 160, collapses 106, survivals 52, outer worlds lost 50
  causes {"drift":57,"fire":25,"cold":14,"syzygy":3,"starless":7}
  peak sun speed 11.934, slowest rate 0.315x

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
