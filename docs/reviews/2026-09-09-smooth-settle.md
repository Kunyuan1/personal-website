# The settle arrives — 2026-09-09

**Scope:** #20, on `main...smooth-settle`. Two teleports at the end of every
Chaotic Era, found by watching the preview rather than by a red invariant.
**Harness:** `npm run sim:report` — 39/39 passing, up from 37/37.

The simulation was watched during the review of #19, and it cut. After every
era the suns and worlds jumped to a default arrangement, and the return to a
Stable Era read as a hard edit rather than a system re-forming.

Both halves of it were on `main` verbatim, and had been since the shadow settle
was written. Every invariant here reads *state*, and both cuts land the bodies
on a correct state — they were only wrong on the way there. Nothing measured
motion, so nothing saw them.

## What was measured

Per-frame displacement over 75 simulated minutes on the report seeds, for the
bodies whose identity survives the frame — the three suns, and `planets[0]`,
which `resetInto` carries across a collapse by design. Outer worlds are
replaced on a collapse, so their apparent jump is a new world appearing, which
is what `worldAlpha` fades in; they are compared on every other frame.

```
                                    n      sun     home    outer   trails cleared
survival re-seed                   42    0.042    3.931   11.531   168
settle ends, shadow adopted       166    1.015    1.286    1.141     0
settling (the blend)            47144    0.086    0.127    0.016     0
ordinary play                  222524    0.043    0.066    0.057     0
collapse (drift)                   40    0.039    0.050    0         0
collapse (scorched)                32    0.042    0.047    0         0
collapse (frozen)                  40    0.042    0.020    0         0
collapse (syzygy)                  12    0.031    0.023    0         0
```

The worst single frame moved a world **11.531 units** — the moth's frame is
6.36 in radius, so that is a body crossing more than the full width of the
frame it is drawn in, between two consecutive frames.

**The collapse path was already correct** at worst 0.05, inside ordinary play.
Carrying Trisolaris across a collapse, added in #19, is the one path that did
this properly, and it is what the other two now do.

## Finding 1 — the blend never arrived, so the code assigned the destination

`advance`, the settle branch. The weight was a fixed fraction per frame:

```ts
const w = 1 - Math.exp(-SIM_FRAME_TIME / (SETTLE_TIME / 4));
```

which is a first-order lag with time constant `SETTLE_TIME / 4 = 1.25`, chasing
a target that is itself orbiting. It does not converge; it settles at a
steady-state lag of about `v x tau` behind. The home world orbits at
`v = sqrt(3/r) ~ 1.0`, so it ended every settle roughly 1.25 units short — and
the adoption at `settle >= 1` turned that distance into a jump, on all 166
settles.

The comment called it *"whatever rounding the blend left behind"*. It was not
rounding. It was the same size every time, and **lengthening `SETTLE_TIME`
makes it worse**: the lag is proportional to the time constant, so a longer
settle is a larger jump held for longer.

**Resolution.** The gap is given an envelope that reaches zero when the settle
does, and the weight is the ratio of consecutive envelope values:

```ts
const envelope = (s: number) => Math.exp(-4 * s) * (1 - s * s * (3 - 2 * s));
```

`exp(-4s)` in settle-fraction units is exactly the old curve, so the opening
frames move as they always did; the smoothstep factor is 1 at the start and 0
at the end, with zero slope at both, so arrival is forced rather than
approached. The adoption is kept and is now provably a no-op — the era still
begins from the validated initial conditions, by convergence instead of
assignment.

## Finding 2 — the survival path placed its worlds, and wiped their trails

```ts
const canonical = planetsFor(sys.orbit);
sys.planets.forEach((p, i) => {
  if (!p.alive) return;
  Object.assign(p, canonical[i], { alive: true, trail: [] });
});
beginSettle(sys);
```

42 of 42 survivals, up to 11.531 units, and 168 trails cleared — every
surviving world, not only the home world, in the frame the survival notice
landed in.

The reasoning behind it was sound and is unchanged: stability depends on a
world's phase relative to the suns, and a world left at an arbitrary angle is
an unvalidated initial condition that is measured to be destroyed during the
following Stable Era. The assignment was the wrong way to act on it.
`beginSettle` builds its shadow from `planetsFor(sys.orbit)` on the very next
line, so once the blend arrives, the worlds **converge** onto that same state.

**Resolution.** Deleted; the settle does the work. The trails come too, as
Trisolaris' already does across a collapse.

**This deletion is only safe after finding 1**, which is why they were done in
that order. With a blend that lagged, deleting the assignment would have left
the worlds near — but not on — a validated phase, which is the condition
measured to destroy them.

## Result

```
                                    n      sun     home    outer
settling                        47144    0.087    0.127    0.162
settle ends, shadow adopted       166    0.024    0.020    0.017
survival re-seed                   42    0.042    0.032    0.036
ordinary play                  222524    0.043    0.066    0.057
```

Worst frame anywhere: **0.162**, an outer world during a settle — the distance
it used to be teleported over, now travelled. Both cuts are gone.

**Nothing downstream moved.** Mortality 73%, causes
`scorched 32 / frozen 40 / drift 40 / syzygy 12`, 124 died / 42 survived / 3
running, worst survivor x1.296, peak sun speed 11.539, closure drift 0.001 and
0.05 — every figure identical to before the change. That follows from what the
old code did: it force-assigned the shadow, so the post-settle state was always
the shadow. Making the bodies arrive there changes the journey, not the
destination.

## New invariants

**`the animation never cuts`** — the worst single-frame displacement of any
body whose identity survives the frame, with the context that produced it.

The bound is **0.3 units**, set from both sides because a limit close to either
is brittle: 1.85x above the worst thing the simulation legitimately does
(0.162) and 3.4x below the smallest cut ever measured (1.015). Planted against,
both ways:

```
(old blend)      FAIL  the animation never cuts   worst 1.286 (home, settle ends, shadow adopted)   exit 1
(old re-seed)    FAIL  the animation never cuts   worst 11.531 (world 3, survival re-seed)          exit 1
```

**`no trail is wiped from a living world`** — a trail that had something to
draw and now has nothing, under a world that is still alive. Planted against:

```
(old re-seed)    FAIL  no trail is wiped from a living world   168   expected 0   exit 1
```

## Considered and rejected

**A linear arrival, `gap(s) = 1 - s`.** The obvious fix, and it does remove the
cut — 0.032, 0.030, 0.026. It was rejected on the thing the settle exists for.
Measured as path length over chord across each settle, it flattens the paths to
**1.19 for the home world and 1.46 for a sun**, against 1.37 and 1.91 for the
blend it replaced. That is bodies sliding to their marks instead of orbiting
home, which is precisely what the shadow was introduced to avoid. The chosen
envelope measures 1.42 and 2.22 — it curves *more* than the code it replaces.

**Feed-forward: chase where the shadow will be, `target + v * tau`.** Cancels
the lag analytically and keeps today's exponential. Measured, it leaves
**0.115 for a sun and 0.160 for the home world** — eight times better than
doing nothing and still five to eight times worse than the envelope. It is also
a cancellation rather than a guarantee: it holds only while `SETTLE_TIME` and
the orbital speeds are what they are today, and it would pass the 0.3 bound on
a margin that moves if either changes. Rejected for being approximately right
by arithmetic rather than exactly right by construction.

**Lengthening `SETTLE_TIME`.** Not viable in principle, as above: the residual
is proportional to the time constant, so this enlarges the jump.

**A direct assertion that a Stable Era begins on canonical phases.** Wanted
while planning, and then found to be already covered twice over. `the animation
never cuts` *is* the convergence test — the adoption compares the blended state
against the shadow every settle, so a body that failed to converge shows up as
the jump the adoption makes. And `any world while stable` catches the
consequence a bad phase would have. A third row asserting the same property was
left out rather than added for the look of it.

## Open

**`SETTLE_TIME` may want re-sweeping, but not for arrival quality.** It was
chosen at 5 against a blend that never arrived, so it was partly tuned against
the lag itself — but under the envelope 93% of the arrival is done by the
halfway point, and the constant no longer controls how well the settle lands.

What a sweep of it actually moves is the first blend frame, which scales as
`1/SETTLE_TIME` and is the real smoothness lever now — halving the constant
takes it from 0.151 to 0.311 and `the animation never whips` goes red — along
with the arrival fade and the settling time charged to `eraElapsed`. Worth
naming which of those a sweep is for, or it gets run against arrival quality
and reads noise. Per `prompts.md` that is a sweep over the real decision path,
not a nudge.

---

# Review findings — 2026-09-09

Seven findings against this branch, all fixed. The review verified the blend
algebra independently and derived the bound rather than taking the measured
one: a surviving world sits inside `escapeRadiusFor` = 7.92 and its shadow
inside 6.0, so the worst possible first-blend-frame step is
`0.0140 x 13.92 = 0.195` — the headroom under the limit is structural, not
luck.

## 1. Every world blinked to invisible on the frame the notice landed — fixed

**Where:** `src/components/SystemCanvas.tsx`

```ts
const worldAlpha = system.settle * hydration;
```

`beginSettle` sets `settle = 0`, so on the first frame of every settle *every
living world and its trail* were drawn at alpha 0 and ramped back over five
seconds. Two bodies never deserved that: Trisolaris, which `resetInto`
deliberately carries across instead of ghosting, and every world of a
civilisation that survived, where nothing is replaced at all.

So the trails this branch went to the trouble of preserving were invisible for
exactly the moment they exist to cover, and the on-screen symptom the new
comment claimed to have fixed — *"the one continuous thing on screen vanished
at the moment the visitor was being told the civilisation had come through"* —
was unchanged. Pre-existing, and in scope precisely because this is the branch
that adds an invariant called *the animation never cuts* and reported it green
over 208 settles that all did this.

**It also inverts the severity ranking in the write-up above.** The 11.531-unit
survival teleport happened on the frame `worldAlpha` went to 0, so it was
masked. The cut a visitor actually saw at full opacity was the 1.286 adoption
jump, where `settle` is 1. The fixes are unchanged; the ordering was wrong.

**Resolution.** `fadesIn` on the world itself, set by `resetInto` for the new
outer worlds and cleared by the adoption, so a world fades in once for the
arrival it belongs to. The fade runs over `WORLD_FADE_TIME` rather than the
whole settle, making it the mirror of the ghost fade it plays against — a world
at 0.3 replaces a ghost at 0.7 instead of the pair dipping through the middle
of the cross-fade. New invariant `no world fades in that was already here`,
planted: `FAIL 124`.

## 2. The step bound was C0 only — fixed

`worstStep` said no body jumps and said nothing about one going from crawling
to sprinting. The envelope's slope at `s = 0` is -4 by design (the anti-freeze
property), so the first blend frame closes 1.4% of whatever gap it starts with:
a world 8 units from its shadow goes from ~0.016 units per frame to ~0.16.

Not a regression — the same probe against the previous commit gives **11.53**,
so this branch improves C1 by 76x. The gap was the *bound*: halving the arrival
time doubles this and would have shipped green.

**Resolution.** `the animation never whips`, on the frame-to-frame change in a
body's step, same 0.3 limit. Worst is 0.151. Planted by halving `SETTLE_TIME`:

```
FAIL  the animation never cuts    worst 0.322 (world 3, settling)   exit 1
FAIL  the animation never whips   worst 0.311 (world 3, settling)   exit 1
```

Bounded rather than removed, deliberately: easing the weight in from zero
smooths it and freezes the bodies at the start of every settle, since during a
settle the blend is the only thing moving them.

## 3. The pinned re-anchor was never instrumented — fixed

Holding the Stable Era open re-anchors through the same `beginSettle` every
`stableDuration`, from worlds that have wandered to 1.85x their radius — a
settle from a *larger* starting gap than the seeded run produces, for as long
as a visitor holds the toggle. The new instrumentation lived only in the seeded
loop.

**Resolution.** `motionWatch` is a helper all three rigs call.

**And it caught a second bug in the fix.** With the rigs wired up the row still
read `worst 0` with the seeded watcher disabled: `record` reads its value at the
moment it runs, and the rows sat beside the long run, which executes *before*
both pinned rigs. They contributed nothing while the row implied they had —
the same shape as the finding itself. The motion rows now sit after every rig.
Verified by disabling the seeded watcher: `worst 0.154 (world 3, settling,
pinned moth)`, matching the review's own 0.1538.

## 4. `SETTLE_TIME` is not the knob the Open item thought — fixed

Under the envelope the gap runs 1, 0.311, 0.068, 0.0078, 0 across
`s = 0, 1/4, 1/2, 3/4, 1`, so 93% of the arrival is done by halfway and the
last two seconds are bodies already sitting on the shadow. Sweeping it moves
the first-frame step (as `1/SETTLE_TIME` — the real smoothness lever), the
arrival fade, and `eraElapsed`, not arrival quality. Written next to the
constant, and the Open item below is rewritten.

## 5. The trail invariant only caught a total wipe — fixed

`was.trail > 30 && p.trail.length <= 1` would have passed a regression that
halved a living world's trail, and the two constants were the only unexplained
numbers in the block. Now a living world's trail may lose at most one point per
frame, the rate `recordTrails` removes them at, with a documented exception for
the collapse frame where `resetInto` truncates the carried home trail to the
new orbit's limit. Planted: `FAIL 168 (worst 691 points)`.

## 6. An unreachable guard — fixed

`if (gapBefore <= 0) return 1;` cannot fire: the only caller is inside
`sys.settle < 1` and `envelope(s) > 0` for every `s < 1`, the smallest
reachable value being `envelope(284h) = 5.6e-9`. Dropped, with the reason
written where it stood.

## 7. "That same validated state" was not `planetsFor`'s — fixed

The shadow integrates every settling frame, so what the worlds converge onto is
the periodic solution advanced by `SETTLE_TIME`, not the canonical starting
angles. The conclusion holds — every phase of a periodic solution is validated,
and the old code adopted the same advanced shadow, which is why the destination
is identical — but a reader checking the claim against the deleted comment
would have found the worlds nowhere near those angles. Clause added, since the
ordering argument depends on it.
