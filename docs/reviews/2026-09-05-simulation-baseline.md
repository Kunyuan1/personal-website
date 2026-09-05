# Simulation baseline — 2026-09-05

**Scope:** `src/lib/trisolaris.ts`, `src/components/EraProvider.tsx`, `src/components/SystemCanvas.tsx`
**Commit:** a0f73d3
**Harness:** `npm run sim:report` — 14/14 passing

Not an external review. This is the state the simulation was left in, recorded
so the first real review has something to diff against.

## Open findings

None.

## Known limitations, deliberately accepted

### Causes can still repeat, about 1 in 7

`pickFate` only ever returns a cause that is actually true of the state. When
the sole true description of a death is the one just reported, it is used
again. Printing a different cause would mean describing something that did not
happen. Currently 11 repeats in 79 collapses.

### Two narrative devices, neither of them physics

1. **The settle.** A chaotic three-body system never returns to a periodic
   orbit on its own. At the end of an era the suns chase a shadow system
   running the periodic solution, over ~4.7s.
2. **Canonical angles.** Worlds surviving an era return to their original
   starting angles, not where chaos left them. Stability depends on a world's
   phase relative to the suns, so an arbitrary angle is an unvalidated initial
   condition — measured, those wander far enough to die during the *following*
   Stable Era.

Both are documented at the top of `trisolaris.ts`. Everything inside an era is
real integration.

### Verified by simulation, not by eye

The preview pane used during development supplies no animation frames, so no
full era cycle was ever watched. Every claim here rests on the harness.
`syzygy` in particular fires about 1 collapse in 90 and its transition has
never been observed; it shares a code path with `fire`, but that is inference.

## Considered and rejected

| Approach | Ruled out by |
| --- | --- |
| No softening between suns | A close encounter is a singularity: peak speed 174, a sun crossing the frame in 0.026s |
| Softening of 2e-4 or more | Breaks the moth, whose suns pass within 0.079 of each other — closure drift 0.089 to 0.927 |
| Adaptive time-step chosen once per frame | An encounter begins and ends inside one frame's 32 sub-steps; worst crossing unchanged at 0.027s |
| Real bodies integrating during the settle | A sun leaving an encounter reached 386 units against a limit of 6 |
| Interpolating sun positions to their targets | Straight-line slide. Chasing an orbiting shadow travels 1.8x–3.6x further and curves |
| `drift` as a lethal condition | Killed worlds the moment they wandered: 104 of 119 deaths, repeats worse than before |
| Two palettes toggled by `data-era` | Only properties with an explicit CSS transition eased; every card and border snapped |
| Worlds inside r≈2.8x the suns' reach | Ejected or swallowed within one Stable Era. This is why the gap around the suns cannot be closed |

## Numbers at the time of review

```
75 simulated minutes across seeds 99, 7, 2024, 5, 31415

  PASS  closure drift: figure-eight over 2T      0.001                   expected < 0.06
  PASS  closure drift: moth over 1T              0.05                    expected < 0.06
  PASS  kick smoothness (median turn vs stable)  1.53 deg vs 1.59 deg    expected ratio < 1.6
  PASS  deaths during a Stable Era               0                       expected 0
  PASS  collapses without a settle               0                       expected 0
  PASS  every death leaves a ghost               108/108                 expected equal
  PASS  sun trails survive a collapse            359 points              expected > 0
  PASS  max sun radius                           6                       expected <= 6
  PASS  home world while stable                  x1.034                  expected < x1.10
  PASS  worst on-screen crossing                 3.47s                   expected > 1.0s
  PASS  all five causes occur                    5                       expected 5
  PASS  consecutive repeats                      11/79 (14%)             expected < 20%
  PASS  notice delay after leaving view          mean 0.92s              expected < 2.0s
  PASS  mortality                                56%                     expected 40-80%

  chaotic eras 140, collapses 79, outer worlds lost 29
  causes {"cold":20,"drift":17,"fire":28,"starless":13,"syzygy":1}
  peak sun speed 12.287, slowest rate 0.304x
```
