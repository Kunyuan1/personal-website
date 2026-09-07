# More worlds review — 2026-09-06

**Scope:** `src/lib/trisolaris.ts`, `scripts/simulation-report.mts`, PR #5
**Commit:** 75abfdf reviewed, fixes on top
**Harness:** `npm run sim:report` — 21/21 passing

Review of the branch that gave each civilisation two more worlds. Two critical
findings, two medium, one nit; all five fixed. The radii themselves were sound
— every per-world ratio the branch claimed was reproduced independently — but
the evidence offered for them was not, and neither was the harness that was
supposed to be checking them.

## Findings

### 1. The harness could not validate any radius but Trisolaris — fixed

**Where:** `scripts/simulation-report.mts`, the stable-era radius check and the
event loop

**What goes wrong:** three separate gaps left every world except `planets[0]`
unchecked.

- `home world while stable` only ever sampled `sys.planets[0]`.
- `deathsDuringStable` sat in the `collapse` branch. A `worldLost` during a
  Stable Era was caught one branch earlier and counted only as
  `outerWorldsLost`, with no invariant attached — and "worlds dying during
  Stable Eras" is the first failure class this harness exists to catch.
- The one check that did count `worldLost`, the pinned run, starts from
  `createSystem()` — civilisation 1, the figure-eight — and being pinned never
  collapses, so it never reaches the moth. `5.05` and `5.5` had no Stable-Era
  coverage at all.

**Evidence:** planting `{ r: 3.0, angle: 30 }` on the moth — a radius this file
records as one the moth does not hold — left the harness printing all-pass and
exiting 0. The only number that moved was `outer worlds lost`. Instrumented,
the planted world reached 1.58x its own radius while
`era === "stable" && settle >= 1`.

**Resolution:** three changes.

- `any world while stable` now maxes over every alive planet, not `planets[0]`.
- A `worldLost` during a Stable Era counts toward `deaths during a Stable Era`,
  measured against the era as it stood *before* the frame — a collapse has
  already reset the era by the time its event is handled. Both kinds measure 0
  over the 75-minute run.
- A pinned rig per solution, eight Stable Eras each, recording every world's
  peak radius. This is the rig the branch was measured with; it is now
  committed, so the numbers behind the `ORBITS` table are printed by the
  harness rather than recorded in prose.

The planted case now fails three checks by name and exits 1 — the third is the
`worldLost` counting above, which catches the deaths themselves rather than the
wandering that led to them:

```
FAIL  deaths during a Stable Era                 39       expected 0
FAIL  any world while stable                     x2.638   expected < x1.10
FAIL  moth: every world holds its orbit          x2.639   expected < x1.10
3 invariant(s) failed
    world  r=3      30deg   peak x2.639
```

The two failure modes are complementary, and it is worth saying why. A world
that dies by wandering *outward* trips the peak check; one that dies *inward*,
by burning or being caught in a syzygy, never exceeds its own radius and trips
only the death count. Planted inward on the moth — `{ r: 1.0, angle: 0 }` — the
peak check reads a comfortable x1.034 and it is the death count, at 40, that
fails the run. Neither check covers the other.

### 2. The extra worlds perturbed the suns — fixed

**Where:** `src/lib/trisolaris.ts`, `timeScaleFor`

**What goes wrong:** `timeScaleFor` maxed over planets as well as suns, and the
resulting scale is applied to the whole system at `integrate(sys, DT * scale)`.
Adding four test particles therefore reached the suns through the step size —
contradicting the file's own opening claim that the planets exert no force back
and the suns' periodic solution stays exact. The branch's before/after table was
consequently not a controlled comparison: chaotic eras 140 → 139 was a different
random experiment rather than an effect of more worlds, and the 56% → 57%
mortality was `79/140` against `79/139`.

**Evidence:** the same seeds run with three/two worlds and with five/four,
comparing sun state every frame. With planets in the maximum, seed 7 diverges at
frame 1264 (~21s). With them removed, all five seeds are identical for the full
5-minute comparison. The throttling the planets contributed was minor: sampled
per frame over the 75-minute run, a planet set the scale in 464 frames of
270,000, and the worst it ever drove was 0.76.

**Resolution:** `timeScaleFor` keys on the suns alone. Re-running the harness
against the pre-branch world tables with otherwise identical code now moves
exactly one number:

```
chaoticEras     140    -> 140   same     maxSunRadius   6      -> 6       same
collapses       79     -> 79    same     peakSunSpeed   12.287 -> 12.287  same
mortality       56     -> 56    same     slowestRate    0.304  -> 0.304   same
repeatRate      14     -> 14    same     worstCrossing  3.47   -> 3.47    same
outerWorldsLost 30     -> 80    MOVED    causes         identical
```

World count is now a display decision, which is what the branch wanted to be
able to claim.

### 3. Lengthening the array re-phased the worlds already there — fixed

**Where:** `src/lib/trisolaris.ts`, `planetsFor`

**What goes wrong:** the starting angle was `(i / planetRadii.length) * 2pi`.
Index 0 is 0 for any count, so Trisolaris was genuinely fixed, but every other
world moved: figure-eight 3.6 from 120° to 144°, 4.2 from 240° to 288°, moth
6.0 from 180° to 270°. `advance` records, from measurement, that stability
depends on a world's phase relative to the suns — so adding a world silently
re-seeded three shipping worlds onto unvalidated initial conditions. They hold,
but that was luck rather than design.

**Resolution:** `planetRadii: number[]` is now `worlds: { r, angle }[]`, angle
in degrees, written down per world. The angles committed are bit-for-bit the
ones the branch was measured at — `(72 * PI) / 180` and `(1 / 5) * PI * 2` are
the same double — so this preserves the measurements rather than inventing new
ones. Adding a world is now a local change.

### 4. The new comment's rationale was contradicted by the code it cited — fixed

**Where:** `src/lib/trisolaris.ts`, the `ORBITS` comment

**What goes wrong:** it claimed extending outward "shrinks the suns on screen".
`drawSun` uses the frame scale for position only and hard-codes corona 34px,
core 4.4px, highlight 1.9px. Nothing on screen changes size with the scale.

**Evidence:** an outermost 5.4 takes the figure-eight from `384.6 / 4.452 =
86.4` px/unit to `384.6 / 5.724 = 67.2` at a 1440×836 hero. The suns are drawn
at exactly the same size, 22% closer together.

**Resolution:** the argument is the same shape but about crowding rather than
size — the three coronas are 68px across and already overlapping at 86px
separation. The comment now says that, with the numbers.

### 5. "Measured over five Stable Eras" no longer described every radius — fixed

**Where:** `src/lib/trisolaris.ts`, the `ORBITS` comment

**What goes wrong:** the sentence was accurate for the original five radii and
wrong for the four added, which were measured over eight eras on a rig that was
not in the diff. Anyone auditing `5.05` had no committed way to reproduce it.

**Resolution:** the rig is now the harness section from finding 1, and the
comment points at `npm run sim:report` instead of quoting a count. The
provenance of a radius is a number the harness prints, so it cannot go stale.

## Considered and rejected

**Extending the worlds outward instead of interleaving.** Rejected on the
corrected reasoning in finding 4: the suns are drawn at a fixed pixel size, so
an outermost 5.4 does not shrink them, it crowds them from 86 to 67 px/unit
while the coronas stay 68px across. The figure-eight becomes a blob.

**Restoring the original angles** (120°, 240°, 180°) for the three pre-existing
worlds when moving to an explicit table. Rejected: those phases were measured
with three and two worlds present, and the combination of the original phases
with the new radii has never been measured at all. The phases the branch was
actually validated at are the ones with evidence behind them, so those are the
ones written down.

**A symmetric band around each world's radius**, rather than a peak. Rejected
by measurement, and this was the branch author's own correction: the shipping
figure-eight home world dips to 0.784 of its radius every era while never
exceeding 1.003 of it, so a symmetric band rejects the current site. The
harness has always bounded only the peak.

**Keeping the planet term in `timeScaleFor` and re-baselining `main` instead.**
Rejected: it makes every future world-count change a physics change, which is
the property finding 2 exists to restore. The throttling given up is worth 0.76
at worst, over 464 frames of 270,000.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415, plus 10 pinned

  PASS  closure drift: figure-eight over 2T        0.001                      expected < 0.06
  PASS  closure drift: moth over 1T                0.05                       expected < 0.06
  PASS  kick smoothness (median turn vs stable)    1.53 deg vs 1.59 deg       expected ratio < 1.6
  PASS  deaths during a Stable Era                 0                          expected 0
  PASS  collapses without a settle                 0                          expected 0
  PASS  every death leaves a ghost                 159/159                    expected equal
  PASS  sun trails survive a collapse              359 points                 expected > 0
  PASS  max sun radius                             6                          expected <= 6
  PASS  any world while stable                     x1.034                     expected < x1.10
  PASS  worst on-screen crossing                   3.47s                      expected > 1.0s
  PASS  all five causes occur                      5                          expected 5
  PASS  consecutive repeats                        11/79 (14%)                expected < 20%
  PASS  notice delay after leaving view            mean 0.92s                 expected < 2.0s
  PASS  mortality                                  56%                        expected 40-80%
  PASS  sun trail within its orbit's limit         worst excess 0             expected 0
  PASS  deaths while pinned (10 min)               0                          expected 0
  PASS  pinned frames outside a Stable Era         0                          expected 0
  PASS  figure-eight: Stable Eras measured         8                          expected 8
  PASS  figure-eight: every world holds its orbit  x1.025                     expected < x1.10
  PASS  moth: Stable Eras measured                 8                          expected 8
  PASS  moth: every world holds its orbit          x1.034                     expected < x1.10

  chaotic eras 140, collapses 79, outer worlds lost 80
  causes {"cold":20,"drift":17,"fire":28,"starless":13,"syzygy":1}
  peak sun speed 12.287, slowest rate 0.304x

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

## Not settled here

**Whether five worlds reads as richer or as cluttered.** The geometry is
settled — over all five seeds the closest two worlds ever get on screen during
a Stable Era is 74.5px at 1440×900, 65.6px at 1280×800 and 37.8px at 390×844,
against halos of 7px and 13px, so worlds never merge or occlude. The taste call
is a separate question and is not one the harness can answer.
