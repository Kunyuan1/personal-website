# Simulation review — 2026-09-05

**Scope:** `src/lib/trisolaris.ts`, `src/components/EraProvider.tsx`, `src/components/SystemCanvas.tsx`
**Commit:** none — the repository has no commits yet; reviewed the working tree as staged/untracked
**Harness:** `npm run sim:report` — 14/14 passing, matching the committed baseline on every line

`npx tsc --noEmit`, `npx eslint .` and `npx next build` are all clean.

**Status:** all six findings fixed, 2026-09-05. The harness is now 17/17 — the
original 14 identical to the baseline on every line, plus three added here to
cover the paths that let these through. See *After the fixes* at the end.

The physics core is in good shape. Every item on the prompt's "check these
hardest" list was verified and none had regressed — details in *Considered and
rejected*. All six findings below are in the layers *around* the integrator: era
bookkeeping in `EraProvider`, trail retention in `trisolaris.ts`, and framing in
`SystemCanvas`. None is caught by the current harness, because the harness never
exercises the pinned toggle, never boots from restored `localStorage`, and never
looks at what is drawn.

## Findings

### 1. `--heat` is stripped from the document on every era change — resolved

**Where:** `src/components/EraProvider.tsx:225`

**What goes wrong:** the cleanup that removes `--heat` is attached to an effect
keyed on `[era]`, so React runs it on every era *change*, not only on unmount.
The rAF loop is what owns `--heat`, and it republishes only when the 1%-quantised
value actually changes (`EraProvider.tsx:179`). So at each transition the property
is deleted and then not restored until heat next crosses a 1% step.
`@property --heat` declares `initial-value: 0` (`globals.css:23-27`), so while it
is absent the whole page — `--void`, `--surface`, `--ink`, `--line`, `--accent`
and `.era-wash`'s opacity — renders fully cold.

The damaging direction is chaotic → stable, which is where a collapse lands: heat
at that moment averages **0.98**, so the page snaps from peak red to black and
back again.

**Evidence:** instrumented `advance` over the same five seeds and 75 simulated
minutes, replaying the provider's publish rule and its era-change trigger:

```
era transitions measured : 279
mean gap                 : 1.9 frames = 31 ms
median gap               : 2 frames
worst gap                : 5 frames = 83 ms
gaps >= 2 frames         : 202
-> stable : n=139  mean gap 2.1 frames  heat at the flip 0.98 -> snaps to 0
-> chaotic: n=140  mean gap 1.6 frames  heat at the flip 0.07 -> snaps to 0
```

139 full-red-to-black flashes in 75 minutes, one at every collapse.

**Resolution:** fixed. The `--heat` removal moved into its own unmount-only
effect; `dataset.era` stayed in the era-keyed one, where cleanup and setup run in
the same commit with no paint between them.

Not measured live. The preview pane issues no animation frames at all — `raf: 0`
over five seconds with `visibilityState: "visible"`, while `setInterval` ticked
241 times — so the simulation is frozen there and no era change can be observed.
The change is structural rather than tuned: React runs the cleanup of an effect
with an empty dependency array only on unmount.

### 2. "Hold Stable Era" does not hold a Stable Era — resolved

**Where:** `src/components/EraProvider.tsx:148`

**What goes wrong:** the pinned branch zeroes `eraElapsed` every frame to stop
`destabilise` firing. That also means the suns are never re-settled. A Stable Era
is designed to run `stableDuration` — 16s, **2.5 figure-eight periods** — and then
be re-seeded from validated initial conditions by `beginSettle`. Pinned, the
integrator holds the same periodic solution indefinitely and closure drift
accumulates until the figure-eight decays into a genuinely chaotic system. The
home world then dies roughly every 100 seconds, while `sys.era` is forced to
`"stable"` and heat therefore decays to 0 — so the UI reports a Stable Era, the
page is fully cold, and collapse notices fire and the civilisation counter climbs
underneath.

The `CHAOS_MAX` timeout cannot rescue it: `advance` reaches the chaotic branch
only when `sys.era === "chaotic"`, and the pin overwrites that every frame.

**Evidence:** pinned 3s into the opening Stable Era — the button's normal use —
then ran the provider's pinned branch verbatim for 10 minutes:

```
seed 99  : civilisations destroyed while pinned: 5
           at: 119s:cold, 211s:starless, 333s:cold, 426s:starless, 547s:cold
           heat at end: 0.0000 (page palette fully cold)
seed 7   : identical
seed 2024: identical
```

Identical across seeds because the pinned branch passes no `rand` and the
trajectory is fully deterministic. The mechanism, holding the solution with no
perturbation and measuring closure drift per period:

```
after  1 periods (6s)  : closure drift 0.0104
after  3 periods (19s) : closure drift 0.0322
after 10 periods (63s) : closure drift 0.1067
after 20 periods (127s): closure drift 0.2130
after 25 periods (158s): closure drift 1.8289   <- no longer the same orbit
after 30 periods (190s): closure drift 2.0619
(a Stable Era is only 16s = 2.5 periods long by design)
```

Drift grows ~0.0107/period and then runs away past ~20 periods. At the designed
2.5 periods it never exceeds ~0.03, which is why nothing else sees this.

**Resolution:** fixed, as suggested: `beginSettle` at `stableDuration` instead of
`destabilise`. The pin now lives on the system as `sys.pinned` and is honoured
inside `advance`, rather than being imposed from the provider by overwriting
`era` and `eraElapsed` every frame — which is what reduced it to stopping a clock.

Re-anchoring only the suns was tried first and measured out. The suns *can* be
put back on exact initial conditions once per orbit period invisibly — worst
one-frame step 0.022 against 0.955 for normal motion — but the worlds' orbits are
quasi-stable, not closed, and that is what the 16s re-seed is really holding
together. With exact suns and free worlds the home world still wandered to 1.85x
its radius and died of cold at 113.4s, identically on all five seeds (pinned, the
simulation never reaches `destabilise`, so it never draws from `rand` and one run
is the whole behaviour, not one sample of it).

Measured over 10 pinned minutes after the fix: 0 deaths, 0 frames outside a
Stable Era, heat 0.0000. The blind spot is closed — see *After the fixes*.

### 3. A sun trail is never truncated when the trail limit shrinks — resolved

**Where:** `src/lib/trisolaris.ts:557`

**What goes wrong:** `recordSunTrails` pushes one point and then shifts *at most
one*. When `sunTrailLength` grows that is enough, but every collapse switches
orbit, and moth → figure-eight drops the limit from 846 to 359. Push-then-shift
nets zero: the trail stays at 846 points for the whole of the next civilisation
and never returns to the intended one period.

Two consequences. The trail is drawn 2.36 laps long instead of one, so
`drawTrail`'s 14-band alpha ramp — designed to fade across exactly one closed
orbit — is spread over more than two and the head no longer meets the tail. And
for the first 846 frames the trail still contains points recorded under the
*moth*, drawn at the figure-eight's framing.

**Evidence:** 15 simulated minutes on seed 99, tracking trail length against the
current orbit's limit:

```
figure-eight limit (1 period) : 359
max trail length actually held: 846 (= 2.36 periods)
longest run stuck over limit  : 10746 frames = 179.1 s
most stale moth-era points held forward: 846
```

Across all five seeds: 35 episodes over the limit, worst excess 487 points.
Invariant 4 cannot catch this — it only asserts the trail length is `> 0`.

**Resolution:** fixed — both halves, because either alone is not enough.
`recordSunTrails` truncates to the limit (a single `splice`, not a `shift`), *and*
`resetInto` truncates the carried trails as it adopts them. With only the first,
every collapse still left exactly one frame drawn 2.36 laps long: that frame's
trails were recorded under the previous orbit's limit before the collapse was
detected, and nothing trimmed them until the next frame.

Measured over 75 simulated minutes: 0 frames over the limit, worst excess 0,
against 35 episodes and a worst excess of 487.

### 4. A restored civilisation number desyncs the orbit rotation — resolved

**Where:** `src/components/EraProvider.tsx:99`

**What goes wrong:** the effect builds `createSystem(1)` and then assigns
`system.civilization = saved`. `createSystem` has already chosen the orbit from
civilisation 1, so the counter moves and the orbit does not. A returning visitor
whose saved civilisation is even is shown "civilisation 4" while the system runs
the figure-eight, which belongs to the odd civilisations. The offset then
persists: the next collapse calls `createSystem(5)`, which is the figure-eight
again — two consecutive civilisations on the same solution, which
`orbitForCivilization`'s contract ("Each civilisation inherits a different
periodic solution, in rotation", `trisolaris.ts:296`) says never happens.

**Evidence:**

```
saved civ 2: UI shows civ 2, runs "figure-eight", should be "moth"  MISMATCH
saved civ 4: UI shows civ 4, runs "figure-eight", should be "moth"  MISMATCH
saved civ 6: UI shows civ 6, runs "figure-eight", should be "moth"  MISMATCH

restored civ 4 ran "figure-eight", civ 5 after its collapse runs "figure-eight"
  -> the same solution twice, back to back
```

**Resolution:** fixed. `localStorage` is read before the system is built and the
value passed to `createSystem(saved)`, and floored on the way in — which also
closes the tampered-storage note below, in the same line.

Measured: 6/6 restored civilisations now run their own orbit, against 3/6; a
restored civ 4 is followed by civ 5 on the *other* solution (moth → figure-eight)
rather than the same one twice; and a stored `"3.5"` yields civilisation 3
instead of throwing in `createSystem`.

### 5. The canvas rescales in one frame at every collapse, under the trails that were deliberately carried across — resolved

**Where:** `src/components/SystemCanvas.tsx:72`

**What goes wrong:** `rescale` derives the scale from `system.orbit`'s outermost
radius, re-read every frame. Because every collapse switches orbit, the scale
changes discontinuously on the frame the collapse lands — while `resetInto`
deliberately carries the sun trails (`trisolaris.ts:599`) and every surviving
world's ghost across that same frame, precisely so nothing blinks. Those carried
pixels are what jumps: the whole figure-eight trail and every fading ghost snap
43% larger or 30% smaller between two frames.

**Evidence:** over the five report seeds, 79 collapses, extent before / after:

```
collapses          : 79
distinct ratios    : 0.7000, 1.4286
every collapse changes orbit: true
```

So invariant 4 holds — the trail survives — but what survives is rescaled in one
frame, which is the same visual discontinuity the invariant exists to prevent.

**Resolution:** fixed, easing over the settle as suggested — with one correction
the obvious version misses. Keyed on the *orbit changing*, it still jumped
x1.4286: a Chaotic Era the home world survives begins a settle without switching
orbit, so the ease ran from whatever orbit happened to precede it, which put the
jump back on a different path. It is keyed on a settle *beginning* instead, and
both scales are derived from the current canvas size every frame so a resize
part-way through a settle stays correct.

Measured over 79 collapses: worst one-frame scale change x1.0019, against
x1.4286.

### 6. The home world's ghost is drawn as a generic outer world — resolved

**Where:** `src/components/SystemCanvas.tsx:255`

**What goes wrong:** `resetInto` ghosts every still-living planet, home world
included, but a `Planet` carries nothing identifying it as home — that is
positional (`planets[0]`), and the ghost list loses the position. The ghost loop
passes `isHome: false` unconditionally. So at the instant Trisolaris dies it pops
from `HOME_COLOR`, a 3.2px core and its ring to `WORLD_COLOR` at 1.9px with no
ring, and its trail from `HOME_COLOR` at 0.5 alpha to `WORLD_COLOR` at 0.28. That
is a hard cut on the one body the design says the eye is tracking — the exact
discontinuity ghosts exist to prevent.

**Evidence:** 79/79 home worlds were ghosted across the five report seeds, and
0/79 carried any field distinguishing them from an outer world's ghost.

**Resolution:** fixed, slightly wider than suggested. `isHome` is set once in
`planetsFor` and carried on the `Planet` itself, so both ghost paths — `killWorld`
and `resetInto` — inherit it through the spreads they already do, and the canvas
reads one source instead of comparing indices in three places. The ghost's
*trail* is drawn at `HOME_COLOR` / 0.5 / 1.1 to match as well, not only its body.

Measured: 79/79 home worlds ghosted carrying `isHome`, 0 ghosts untagged.

## Considered and rejected

Everything on the prompt's "check these hardest" list was verified and none had
regressed. Recorded here so the next review does not re-derive them.

- **`drift` made lethal again.** It has not been. `fatesOf`
  (`trisolaris.ts:468-483`) pushes only `syzygy`, `fire`, `cold` and `starless`;
  `drift` appears only in `describeFates`, and only behind the same band test the
  caller already passed. The harness agrees: 17 `drift` causes out of 79
  collapses, repeats 11/79 (14%), mortality 56% — nowhere near the 104/119 the
  lethal version produced.
- **An early return in `resetInto` skipping the settle.** There is no early
  return; `beginSettle` is called unconditionally at `trisolaris.ts:613` and the
  escaped-sun clamp runs *after* it, on the settle's starting positions. Measured:
  0 collapses without a settle.
- **Real bodies integrating during the settle.** Only `integrateBodies(shadow…)`
  runs inside the settle branch; the real bodies are blended and their
  accelerations recomputed, never stepped. Max sun radius 6.0 against the limit of
  6, versus 386 when this was wrong.
- **`timeScaleFor` hoisted out of the sub-step loop.** It is inside it
  (`trisolaris.ts:690`), re-evaluated per sub-step. Worst on-screen crossing
  3.47s against the 1.0s floor.
- **A React re-render per frame in `EraProvider`.** None found. Every `setState`
  in `tick` is guarded by a closure-local mirror. The one imperfection is
  `lastStabilised`, which `setStabilised` does not update, so a toggle causes one
  redundant `setStabilisedState` with the same value on the next frame — React
  bails out on an unchanged value and the mirror corrects itself immediately. Not
  a per-frame render, so not reported.
- **`localStorage` causing a hydration mismatch.** It does not. Both restored
  values are applied to the system and pushed out through `queueMicrotask`, so the
  server render and the first client render both use the `useState` defaults. This
  is done correctly and deliberately.
- **`eraElapsed` double-counted when `settle < 1` with no shadow.** `advance`
  would fall into the `else` branch and then add `SIM_FRAME_TIME` again at
  `trisolaris.ts:701`. Measured across 75 simulated minutes: **0 frames** in that
  state. `settle` and `shadow` are only ever set together. Not a defect.
- **Duplicate `"drift"` at `trisolaris.ts:761`.** `describeFates` re-appends
  `drift` to a list that already ends with it, because the caller's guard is the
  same band test. `pickFate` takes the first non-repeat, so behaviour is
  identical. Cosmetic only; not worth a change.
- **Re-anchoring only the suns to hold a pinned Stable Era.** Tried while fixing
  finding 2 and measured out; see there. It is invisible and it keeps the suns
  exact, and it still lets the home world escape at 113.4s. What a Stable Era is
  really holding together is the *worlds'* orbits, which are quasi-stable rather
  than closed, and only a whole-system re-seed does that.
- **Keying the canvas scale ease on the orbit changing.** Tried while fixing
  finding 5 and measured out; see there. It reads as the obvious trigger — every
  collapse switches orbit — but the survival path settles without switching, and
  easing that one from a stale orbit reintroduced the same x1.4286 jump.
- **A tampered `localStorage` civilisation crashing the boot.** `"3.5"` passes
  `Number.isFinite(saved) && saved >= 1`, and `ORBITS[(4.5) % 2]` is `undefined`,
  so `createSystem` would throw on `orbit.planetRadii`. Only reachable by editing
  storage by hand, so noted rather than reported. A `Math.floor` on the restored
  value would close it alongside finding 4 — and did, in the same line.

## The `syzygy` gap — a reproduction

The prompt records that `syzygy` fires about 1 collapse in 90 and that its
transition has never been observed running. It does fire, and it is reproducible.
Scanning `mulberry32` seeds over 6 simulated minutes each, from `createSystem()`:

| seed | first `syzygy` collapse |
| --- | --- |
| 2 | 84.3s |
| 12 | 247.2s |
| 17 | 349.8s |
| 18 | 195.8s |
| 32 | 108.5s |
| 38 | 112.8s |

**Seed 2 at 84.3s** is the cheapest reproduction. The condition itself is not
rare — it held on 82 frames across the scan, with the tightest conjunction at a
sun spread of **0.0748** against the 0.75 threshold. What makes the *cause* rare
is that `fatesOf` orders `syzygy` first but the home world's fate is only read on
the frame it actually dies, and a conjunction tight enough to bunch all three
suns usually kills by `fire` on an earlier frame. So the path is exercised; it is
`pickFate` reaching it that is rare. Worth adding seed 2 to the harness as a
fixed case so the `syzygy` notice copy is covered.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415

  PASS  closure drift: figure-eight over 2T      0.001                      expected < 0.06
  PASS  closure drift: moth over 1T              0.05                       expected < 0.06
  PASS  kick smoothness (median turn vs stable)  1.53 deg vs 1.59 deg       expected ratio < 1.6
  PASS  deaths during a Stable Era               0                          expected 0
  PASS  collapses without a settle               0                          expected 0
  PASS  every death leaves a ghost               108/108                    expected equal
  PASS  sun trails survive a collapse            359 points                 expected > 0
  PASS  max sun radius                           6                          expected <= 6
  PASS  home world while stable                  x1.034                     expected < x1.10
  PASS  worst on-screen crossing                 3.47s                      expected > 1.0s
  PASS  all five causes occur                    5                          expected 5
  PASS  consecutive repeats                      11/79 (14%)                expected < 20%
  PASS  notice delay after leaving view          mean 0.92s                 expected < 2.0s
  PASS  mortality                                56%                        expected 40-80%

  chaotic eras 140, collapses 79, outer worlds lost 29
  causes {"cold":20,"drift":17,"fire":28,"starless":13,"syzygy":1}
  peak sun speed 12.287, slowest rate 0.304x
```

Identical to the committed baseline on every line.

## After the fixes

Same command, same five seeds, same 75 simulated minutes:

```
  PASS  closure drift: figure-eight over 2T      0.001                      expected < 0.06
  PASS  closure drift: moth over 1T              0.05                       expected < 0.06
  PASS  kick smoothness (median turn vs stable)  1.53 deg vs 1.59 deg       expected ratio < 1.6
  PASS  deaths during a Stable Era               0                          expected 0
  PASS  collapses without a settle               0                          expected 0
  PASS  every death leaves a ghost               108/108                    expected equal
  PASS  sun trails survive a collapse            359 points                 expected > 0
  PASS  max sun radius                           6                          expected <= 6
  PASS  home world while stable                  x1.034                     expected < x1.10
  PASS  worst on-screen crossing                 3.47s                      expected > 1.0s
  PASS  all five causes occur                    5                          expected 5
  PASS  consecutive repeats                      11/79 (14%)                expected < 20%
  PASS  notice delay after leaving view          mean 0.92s                 expected < 2.0s
  PASS  mortality                                56%                        expected 40-80%
  PASS  sun trail within its orbit's limit       worst excess 0             expected 0
  PASS  deaths while pinned (10 min)             0                          expected 0
  PASS  pinned frames outside a Stable Era       0                          expected 0

  chaotic eras 140, collapses 79, outer worlds lost 29
  causes {"cold":20,"drift":17,"fire":28,"starless":13,"syzygy":1}
  peak sun speed 12.287, slowest rate 0.304x
```

The original 14 are unchanged on every line, including every derived count: the
fixes are confined to the pinned path, the trail limit, the restore, and drawing.

The three new invariants close the blind spots this review ran into. Two of the
six findings survived a first attempt at a fix and were caught only by
measurement, which is the argument for putting them in the harness rather than in
a note here:

- **sun trail within its orbit's limit** — invariant 7 only asserts the trail is
  `> 0` after a collapse, which is why a trail held 2.36 laps long for three
  minutes passed it.
- **deaths while pinned** and **pinned frames outside a Stable Era** — nothing
  had ever run the pinned path. One run covers it: pinned, the simulation never
  reaches `destabilise` and so never draws from `rand`.

`npx tsc --noEmit`, `npx eslint .` and `npx next build` are clean.
