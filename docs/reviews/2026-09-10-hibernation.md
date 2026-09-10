# Hibernation — 2026-09-10

**Scope:** #9, on `main...hibernation`. Tell a returning visitor how long they
were gone and what the system did without them.
**Harness:** `npm run sim:report` — 43/43 passing, up from 42/42.

The ticket's own rate had gone stale, which turned out to be the most useful
thing in it.

## The rate was 61% wrong

Measured on `main` as of #22 — 10 seeds x 15 min, 150 minutes of watching, 255
collapses:

```
seconds of watching per civilisation
  mean 34.5   median 26.5   min 18.7   p90 59.0   max 209.1

civilisations per hour   102      (ticket: 63.2)
civilisations per day  2,448      (ticket: 1,517)
```

The ticket's figure was measured honestly and then went wrong sitting still,
because #15, #17, #19 and #21 changed what ends a Chaotic Era. Only a collapse
advances the counter, so raising mortality from 66% to 73% raised this rate
directly, and nothing anywhere noticed. The drafted copy went with it: *"an
estimated 16,700 civilizations"* for 11 days is really **26,928**.

**So the constant ships with a row that re-measures it.** The ticket asked for
provenance *"the way `ORBITS` documents where its radii came from"* — but
`ORBITS` does something stronger than document:

> the comment cannot go stale because the number is recomputed rather than
> recorded.

A comment recording where a number came from is exactly what this ticket had.
`civilisations per hour matches the constant` fails when the simulation and
`CIVILIZATIONS_PER_HOUR` disagree by more than 8%, measured over the same ten
seeds the departure rate uses. Planted against, with the figure the ticket
quoted:

```
FAIL  civilisations per hour matches the constant   102 vs 63.2   expected within 8%   exit 1
```

**Per hour, not a mean gap.** The distribution is badly skewed — median 26.5s
against a worst of 209.1s — so a mean interval is a poor thing to quote at a
visitor. An hour is long enough for the tail to average out.

## What was built

`trisolaris.lastSeen` is written whenever the page goes away — `visibilitychange`
when it hides, `pagehide` when it is closed outright, the effect cleanup, and a
sixty-second beat while the tab is visible — and read once on the way back.

All of that lives in **its own effect**, which is the correction from the review
below: the first version registered it inside the simulation effect, which
returns early under reduced motion, so a reduced-motion visitor recorded
nothing after their first load.

Under 30 minutes says nothing. Over, a third
`Notice` kind renders through `EraNotice`, in neither of the two outcome
colours, because a hibernation is the one notice here that is not reporting
something the animation just did.

`HIBERNATION_MIN_MS` is well clear of `DEHYDRATION_MS`: five seconds makes the
*animation* treat a return as a rehydration, half an hour makes it worth
telling someone what they missed, and they should not fire together on a lunch
break.

The gap is published on a **microtask**, not through the frame loop. That is
the lesson from #18, where exactly this kind of one-shot value was published
from `tick`, which does not run for a visitor who prefers reduced motion or one
whose tab is hidden at load. Driven here in a background tab, which is that
case, the notice appears correctly.

## The collision the ticket could not see

#18 shipped a second one-shot message the day before: `Fleet departed after
#26 · system re-formed`. A visitor returning after a week whose last session
ended in a departure would get both on one load.

**The departure wins and the hibernation notice stands down for that visit.**
It is the rarer and more specific event, and two "here is what you missed"
messages stacked on one load read as a changelog rather than as either of the
things they are. Driven: with both armed, the acknowledgement shows, the
hibernation notice does not, the counter resets and the departure flag is
consumed.

## Testing it: the ticket's recipe does not work

The ticket says to *"set `trisolaris.lastSeen` by hand in devtools to a
timestamp days in the past and reload"*. That cannot work, and the reason is
worth writing down: **reloading fires `pagehide` on the outgoing page**, which
writes `lastSeen = now` before the new document reads it. The value is
destroyed by the act of testing it.

What does work is to set the value from a *different* tab, or to route the tab
being tested through a page that does not run the app — `/icon.svg` serves —
so that nothing overwrites the value on the way in:

```
1. navigate the test tab to http://localhost:3000/icon.svg
2. from another tab: localStorage.setItem("trisolaris.lastSeen", String(Date.now() - 11*24*3600*1000))
3. navigate the test tab back to /
```

## Verified

Each duration driven this way, and the copy read at each:

```
20 minutes   (nothing)
31 minutes   "for 31 minutes. An estimated 53 civilizations"
4 hours      "for 4 hours. An estimated 408 civilizations"
11 days      "for 11 days. An estimated 26,928 civilizations"
3 months     "for 3 months. An estimated 222,768 civilizations"
```

- [x] 43/43 invariants, exit 0, the new one planted against
- [x] Mortality, causes, motion bounds and the departure rate all unmoved
- [x] Departure suppresses hibernation, driven with both armed
- [x] Announced in a **background tab**, which is the hidden-at-load case the
      microtask publish exists for. Note this covers reduced motion for
      *publishing* only — recording is a separate path, and the review below
      is where that distinction turned out to matter
- [x] `tsc --noEmit`, `eslint .`, `check:glyphs` (95 glyphs, 冬眠 added),
      `next build`

## Not verified by driving

**`localStorage` unavailable.** Every access added here is inside the same
try/catch treatment the civilisation key already has, and a throw leaves
`awayMs` at 0 and shows nothing — but the browser tooling available cannot
revoke storage for an origin, so this is verified by inspection rather than by
running it.

## Accepted knowingly

The notice says tens of thousands of civilisations rose and fell; the footer
says `文明 Civilization #1`. Those two numbers are on screen **at the same
time**, and they disagree.

The ticket chose this deliberately — report the estimate, do not advance the
counter — and the alternative is worse: advancing fully makes a visitor
civilisation #40,000 within a month and the counter stops meaning anything. The
word *estimated* carries it, and the simulation being paused while nobody
watches is true and quietly in character for a site about a system that only
exists while someone is looking at it.

It is written down here rather than left to be discovered because this codebase
has twice deleted things for a notice contradicting what was beside it — and
this one is a contradiction that was chosen, not missed.

---

# Review findings — 2026-09-10

Six findings, all fixed. The measurement half of this change came through
clean; every finding was on the other half — how the gap is *recorded*, and who
is told about it.

## 1. Reduced motion never recorded a visit — fixed

The simulation effect returns early under `prefers-reduced-motion: reduce`,
before the listeners were registered and without a cleanup. So on that path
`lastSeen` was written exactly once, at load, and every later visit measured
its absence from the **start of the previous session**. Forty minutes of
reading and a five-minute break announced a forty-five minute hibernation; an
hour of reading and a coffee announced two hours.

The review is right that the verification made this easy to miss: the PR
reasoned about reduced motion and got the *publish* half right — `queueMicrotask`
rather than `tick` — and proved it in a background tab. But a background tab is
not the reduced-motion path, and publishing is not recording.

**Resolution.** Presence recording is its own effect. Whether someone was here
has nothing to do with whether the suns are moving, and it no longer shares a
lifetime with them. Driven with the reduced-motion branch forced on: loaded,
left after nine seconds, and the stored value moved by nine seconds — where the
old code recorded zero.

A sixty-second beat while the tab is visible was added with it, for the case
the review flagged as the same shape but narrower: a tab that crashes, is
force-quit, or is discarded under memory pressure fires neither `pagehide` nor
`visibilitychange`, and the whole session used to count as time away. The beat
stops while hidden — beating in a hidden tab would erase the absence it exists
to measure.

## 2. The notice was consumed on every route and rendered on one — fixed

`EraProvider` is in the root layout, so the gap was read, `lastSeen` overwritten
and the notice armed on every entry; `EraNotice` renders only on `/`. A visitor
returning after eleven days through a bookmark to `/projects` saw nothing, and
eleven seconds later the message was gone for good — the next visit measured
from that one.

**Resolution.** The gap is held in a ref and published when the visitor is
somewhere it can be seen. Driven: nothing on `/projects`, and the message
appears on navigating home. The sibling one-shot does not have this problem
because `Footer` is in the layout — which is exactly the asymmetry the review
used to find it.

## 3. The estimate ignored a pinned Stable Era — fixed

A visitor holding the era toggle has `STABILISED_KEY` persisted, and `advance`
re-seeds a Stable Era for as long as it is held: zero collapses, by
construction, permanently, by their own choice. They were still told 26,928
civilisations rose and fell.

The review draws the right distinction. The `文明 #1` contradiction this PR
accepted is a number larger than the counter beside it. This one describes
events the visitor's own setting guarantees did not happen, and the pin is the
one control on the page that says *make this stop*.

**Resolution.** No hibernation notice while pinned. Driven with the toggle
persisted: silent, and the footer reads `Allow Chaotic Eras`.

## 4. `formatAway` could emit "1 hours" — fixed

`minutes` and `hours` were each rounded independently from `ms`, so the `< 90`
guard and the printed hour value could disagree: at 89 minutes 42 seconds
`Math.round` gave 90 minutes, the guard failed, and the hour branch printed "1
hours" — the exact output the overshoot thresholds were written to prevent.

**Resolution.** Every threshold reads `ms` rather than a rounded value, and one
helper handles the singular for all four units. Checked at each boundary:

```
89m42s -> 90 minutes     90 min -> 2 hours      35.6 h -> 36 hours
36 h   -> 2 days         59.6 d -> 60 days      60 d   -> 2 months
```

## 5. The hibernation timer escaped cleanup and the notice mutex — fixed

It was assigned inside a `queueMicrotask` callback while the cleanup read the
variable synchronously, so in StrictMode it was never cleared; and the collapse
and survival handlers only cleared *their* timer, so an orphan could blank
whatever notice was on screen when it fired. Unreachable today only because the
shortest `stableDuration` is longer than the notice window — which is accident,
not design.

**Resolution.** One `noticeTimerRef` for every notice, cleared before each is
armed and in both cleanups.

## 6. The write-coverage claim in this document was not true — fixed

It said `lastSeen` was written by three handlers, none of which was registered
under reduced motion, and the checklist presented the background-tab drive as
covering reduced motion. It covered it for publishing, not for recording, and
that distinction is where finding 1 lived. Both corrected above.

## Left alone, deliberately

`CIVILIZATIONS_PER_HOUR` is measured on an unpinned system that runs past
`DEPARTURE_AT`, while the page stops at 25. The review notes it and would leave
it; so would I. It is an estimate about a simulation that was paused the whole
time, and making the rig model the page's own stopping conditions would be
precision the number cannot carry.
