# Survival notice review — 2026-09-07

**Scope:** `src/components/EraNotice.tsx`, `src/components/EraProvider.tsx`, `scripts/simulation-report.mts`, `tsconfig.json`, PR #6
**Commit:** 8e83b5e reviewed, fixes on top
**Harness:** `npm run sim:report` — 22/22 passing

Review of the branch that announces surviving a Chaotic Era. One critical, two
medium, two nits; all five fixed. The premise held up — 60 of 140 Chaotic Eras
end in survival and none of them said so — and the new invariant has teeth.
What the review found was that the tooling meant to catch the branch's own
mistakes could not see the file the mistake was in.

## Findings

### 1. `tsc` never looked at the harness — fixed

**Where:** `tsconfig.json`, the `exclude` array

**What goes wrong:** `"exclude": ["node_modules", "scripts"]` overrode the
`"**/*.mts"` entry in `include`, so neither `npx tsc --noEmit` nor `next build`
ever typechecked `scripts/simulation-report.mts`. Every checklist in this repo
that says `tsc ✓` was true and covered nothing in the harness.

That is how this branch's own bug shipped. The event loop treated any event
that was not `era` or `worldLost` as a collapse, so adding `survived` to
`SimEvent` counted every survival as a death — mortality 100%, an `undefined`
cause in the tally, four invariants red. It was a compile error the entire time.

**Evidence:** typechecking the harness under a config that includes `scripts/`,
with the `survived` branch deleted, fails immediately — before the report is
ever run.

**Resolution:** dropped `"scripts"` from `exclude`. The harness imports
`../src/lib/trisolaris.ts` by its real extension, which is how
`node --experimental-strip-types` runs it unbuilt, so `allowImportingTsExtensions`
goes with it. `next build` is unaffected.

The shape that allowed it is gone too. The chain now tests `collapse`
explicitly and ends in an exhaustive `else` that assigns to `never`, so the
next `SimEvent` member is a compile error rather than a silent miscount.
Re-deleting the `survived` branch now produces one error naming the missing
case:

```
scripts/simulation-report.mts(199,15): error TS2322: Type
  '{ type: "survived"; civilization: number; }' is not assignable to type 'never'.
```

That is a better error than the seven the old shape produced, which pointed at
every downstream `event.cause` read rather than at the missing branch.

### 2. The notice could fade in but not out — fixed

**Where:** `src/components/EraNotice.tsx`, `src/components/EraProvider.tsx`

**What goes wrong:** the wrapper carried `transition-all duration-700` and
swapped `opacity-100` for `opacity-0`, but the text was rendered conditionally
on the same state. When the dismiss timer fired, React applied both changes in
one commit: the wrapper began its 700ms fade and the `<p>` left the DOM. There
is no exit-animation mechanism anywhere — no `@starting-style`, no transition
on the `<p>`, no deferred unmount — so the panel cut out mid-sentence and an
empty div slid away behind it. Entry animated because the `<p>` mounts while
the wrapper is still at `opacity-0`.

Carried over verbatim from `CollapseNotice`, so not a regression — but this
branch takes a visitor from 79 notices per 75 simulated minutes to 139, so a
one-way fade now reads as broken twice as often.

**Resolution:** the provider holds the last notice and tracks whether it is up
as separate state. `setNotice(null)` no longer exists anywhere; the timer
clears `noticeVisible` instead, so the panel fades with its words still in it.

### 3. The notice rendered site-wide; the system does not — fixed

**Where:** `src/components/EraNotice.tsx`, mounted from `src/app/layout.tsx`

**What goes wrong:** `EraNotice` sits in the root layout and rendered on every
route, while `SystemCanvas` is mounted only by `Hero`, which only `/` renders.
On `/about`, `/projects`, `/resume` and `/contact` a fixed backdrop-blurred
panel slid up announcing the fate of a civilisation with no suns, no worlds and
no era badge anywhere on screen. Announcing survivals as well as deaths took
that from roughly 16% of a visitor's time to 25%.

**Resolution:** gated on `/`. Verified from served HTML — `aria-live` present
on `/`, absent on `/about` and `/resume`.

### 4. One long value broke the report's column alignment — fixed

**Where:** `scripts/simulation-report.mts`, the printed report

**What goes wrong:** `79 died + 60 survived + 1 running` is 33 characters
against a fixed `padEnd(26)`, so the new row was the only one whose `expected`
sat in a different column — and it was the row a reader most wanted to compare.
This report is read by eye, diffing one run against another, and a ragged
column is precisely what makes that hard.

**Resolution:** the value column is measured from the widest value, the way the
name column already was.

### 5. Stale figures — fixed

**Where:** the commit message and the PR description

**What goes wrong:** the branch quoted `60 of 139` and mortality `57%`. Those
were the pre-#5 numbers; on this branch the harness prints 140 and 56%.

**Resolution:** both corrected. The rebase onto `main` is what settled them —
see below.

## Rebased onto `main` before reviewing

Worth recording, because it changed one finding. This branch was cut before #5
and both touch the harness, so it was rebased onto `main` first. The only
conflict was in the event loop: this branch set `insideChaos = false` on
`survived`, and `main` had already deleted `insideChaos` in favour of reading
the era state *before* each frame.

The review noted, correctly, that clearing `insideChaos` on `survived` also
repaired `deathsDuringStable` — which had been partly vacuous, since the flag
was only cleared on a collapse and so stayed `true` through any Stable Era that
followed a survival. That repair is now redundant: `main`'s `stableBefore` does
it more thoroughly, for outer worlds as well as the home world. Resolved in
`main`'s favour, and the invariant is stronger than either branch made it.

## Considered and rejected

**Holding the last notice in a ref inside `EraNotice`**, per the review's first
suggestion. Rejected by the repo's own lint: `react-hooks/refs` forbids reading
or writing `ref.current` during render, which is what the previous-value
pattern requires.

**Holding it in `useState` updated from a `useEffect`.** Rejected the same way —
`react-hooks/set-state-in-effect` forbids calling setState synchronously in an
effect body. This one would also have been the wrong shape: the state belongs
to the notice's lifecycle, which the provider already owns along with the
dismiss timers.

**Folding the survival outcome into the era badge** instead of route-gating the
notice, the review's second option for finding 3. Rejected because the badge is
rendered by `Hero`, so it is home-only too — it would have removed the notice
from the other routes by removing it everywhere, and lost the fate text that is
most of what this branch adds.

**A fixed wider pad for the value column.** Rejected in favour of measuring it:
a constant is what broke this time, and the name column next to it was already
measured.

## Numbers at the time of review

```
Trisolaran simulation report
75 simulated minutes across seeds 99, 7, 2024, 5, 31415, plus 10 pinned

  PASS  closure drift: figure-eight over 2T        0.001                             expected < 0.06
  PASS  closure drift: moth over 1T                0.05                              expected < 0.06
  PASS  kick smoothness (median turn vs stable)    1.53 deg vs 1.59 deg              expected ratio < 1.6
  PASS  deaths during a Stable Era                 0                                 expected 0
  PASS  collapses without a settle                 0                                 expected 0
  PASS  every death leaves a ghost                 159/159                           expected equal
  PASS  sun trails survive a collapse              359 points                        expected > 0
  PASS  max sun radius                             6                                 expected <= 6
  PASS  any world while stable                     x1.034                            expected < x1.10
  PASS  worst on-screen crossing                   3.47s                             expected > 1.0s
  PASS  all five causes occur                      5                                 expected 5
  PASS  consecutive repeats                        11/79 (14%)                       expected < 20%
  PASS  notice delay after leaving view            mean 0.92s                        expected < 2.0s
  PASS  mortality                                  56%                               expected 40-80%
  PASS  every Chaotic Era resolves                 79 died + 60 survived + 1 running expected 140
  PASS  sun trail within its orbit's limit         worst excess 0                    expected 0
  PASS  deaths while pinned (10 min)               0                                 expected 0
  PASS  pinned frames outside a Stable Era         0                                 expected 0
  PASS  figure-eight: Stable Eras measured         8                                 expected 8
  PASS  figure-eight: every world holds its orbit  x1.025                            expected < x1.10
  PASS  moth: Stable Eras measured                 8                                 expected 8
  PASS  moth: every world holds its orbit          x1.034                            expected < x1.10

  chaotic eras 140, collapses 79, survivals 60, outer worlds lost 80
  causes {"cold":20,"drift":17,"fire":28,"starless":13,"syzygy":1}
```

## Not verified

**The fade-out, visually.** The fix is structural and the mechanism is gone at
the root — `setNotice(null)` does not exist any more — but nobody has watched
the panel fade. The reviewer could not either, and the reason is worth
recording so the next person does not spend time on it: the browser preview
pane renders with `document.visibilityState === "hidden"` regardless of which
tab is fronted, so `EraProvider`'s `visibilitychange` handler keeps the
simulation paused and no era ever resolves. A hidden tab also gets no
`requestAnimationFrame`, so there is no way around it from inside the pane.

Check it in an ordinary browser window against `next dev`, where a Chaotic Era
resolves roughly every 30 seconds.

**Addendum, 2026-09-08.** The mechanism above is half right, and the half that
is wrong costs the next person the same afternoon. Measured from inside the
pane while building the dehydration feature: it reports
`document.visibilityState === "visible"`, not `"hidden"`. What it does not do
is deliver `requestAnimationFrame` — 0 frames in 1.6s — because the pane
itself is hidden behind the conversation. So the simulation is frozen for a
reason the page cannot see: `visibilitychange` never fires, the pause never
engages, and nothing in `EraProvider` is at fault. Taking a screenshot does
not unstick it.

Two ways through it, both used to verify the dehydration transition:

- Have the human open the Browser pane. Frames resume.
- Drive a headless Chrome over CDP and override `document.hidden` with
  `Object.defineProperty`, then dispatch a synthetic `visibilitychange`. Only
  the signal is faked; the handler, the thresholds and the canvas are the
  shipped code, sampled per frame.
