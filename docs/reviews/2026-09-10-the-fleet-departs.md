# The fleet departs — 2026-09-10

**Scope:** #18, on `main...fleet-departs`. The planet is finally allowed to be
lost, and the site is given a way back from it.
**Harness:** `npm run sim:report` — 42/42 passing, up from 41/41.

The ticket refused to be designed before it was measured: *"Nobody knows how
often a genuine collision actually happens... Measure first, then design. Do
not build the ending on the assumption that the collision path fires."* It
does not fire. That measurement is the substance of this change, and it chose
the trigger.

## The measurement

10 seeds x 15 min = **150 simulated minutes**, 338 Chaotic Eras, home world
only, on `main` as of #21.

**Closest approach to a sun, per Chaotic Era:**

```
min 0.0326   p1 0.0423   p5 0.1152   p25 0.9731   median 2.0979

eras with a pass closer than 0.22  (BURN_RADIUS)   27   8.1%
eras with a pass closer than 0.05                   5   1.5%
eras with a pass closer than 0.024 (drawn core)     0     0%
```

**A genuine collision never happens.** Over 150 simulated minutes Trisolaris
never came within the radius of the disc it is drawn as. The closest it ever
got was 0.0326 against a drawn core of 0.024 — 1.36 core radii, a near miss.

That number is measured under the shipping rules, where an era ends the moment
exposure kills the civilisation, so the obvious objection is that the deepest
passes are being cut short by the death. Re-measured with the exposure death
suppressed, letting a doomed era play out:

```
                                    shipped model    death suppressed
closest approach ever                    0.0326           0.011
eras inside the drawn core               0 of 334         3 of 308
eras closer than 0.05                    5 (1.5%)        18 (5.8%)
unbound and outside its orbit           11 (1/13.6 min)  19 (1/7.9 min)
```

So the trajectory exists — a world that kept going would hit in about 1% of
eras — and **the scorching always gets there first**. Making a collision fire
would mean exempting a falling world from the death #17 established, which is
a worse change than the ending is worth.

**Unbound escape does fire.** Specific orbital energy `v^2/2 - sum(1/d)`
against the three suns, positive while outside its own orbit: 11 of 338 eras,
about one per 13.6 minutes. With the dwell below it is 4 in 75 minutes on the
report seeds, one per 18.8 minutes, and that rate is now a reported row.

**And the gate is cheaper than the ticket assumed.** Collapse rate is 1.7/min,
so civilisation 50 arrives after about **29 minutes** of cumulative watching,
not the 45-60 the ticket estimated. Left at 50: past the gate the ending is
then roughly 19 minutes further on, which lands the whole arc inside the
ticket's original estimate by a different route.

## What was built

**`specificEnergy`, and a `lost` event.** Energy rather than distance, because
distance cannot tell a planet that is leaving from one being thrown about — the
home world routinely reaches twice its own radius and comes back. `UNBOUND_DWELL`
is 1 unit of simulation time for the same reason `LETHAL_EXPOSURE` is: 28 eras
touch positive energy at some point and only 18 hold it, and the difference is
what a slingshot looks like from the inside.

**The simulation decides nothing.** `advance` reports that the planet is
unbound and the era resolves exactly as it always did — mortality is 73% and
the cause spread is unchanged, asserted rather than assumed. The gate lives in
`EraProvider` because the counter it reads lives there, in `localStorage`. That
split is also what makes the ending trivially testable, per the ticket's
constraint: **set `localStorage["trisolaris.civilization"]` to 50 and wait.**
No simulation state has to be forged.

**The ending does not persist as a landing state.** This is the one design
question the ticket left open, and it had to be answered because its two
requirements pull against each other: reaching the ending is cumulative across
visits, but *"do not let the end state be the default experience for a
returning visitor"*. So the **fact** persists and the **state** does not. The
next visit re-forms the system from civilisation 1 and says so once — `Fleet
departed after #63 · system re-formed` — and the flag is consumed as it is
read. The ending is earned, acknowledged, and never the thing a recruiter
lands on twice.

**Begin again** sits in the footer beside the era toggle, as specified, and is
repeated in the departure panel because that panel covers the hero and an
ending with no visible exit is worse than an ending. It is rendered only while
departed: a reset offered against a system that is running fine is an
invitation to wipe an hour of someone's history.

## Found by driving it, not by measuring it

**The acknowledgement never appeared.** It was published through the frame
loop, the way `civilization` and `stabilised` are — and the frame loop does not
run for a visitor who prefers reduced motion, or one whose tab is hidden at
load. Driven in a hidden tab it never rendered at all. It is a one-shot message
that has to survive both, so it is published on a microtask from the effect
that reads it. Nothing in the harness could have seen this; it took clicking.

## Verified

- [x] 42/42 invariants, exit 0. `Trisolaris reported unbound` is a reported
      row rather than a pass/fail: the rate is a design input, and asserting it
      would be asserting a taste
- [x] Mortality 73%, causes `32/40/40/12`, 124 died / 42 survived — unmoved,
      which is the proof the gate changes nothing below it
- [x] The motion bounds from #21 unmoved: 0.162 and 0.151
- [x] Departure panel renders, `Begin again` clears it, resets the counter to 1
      and withdraws the footer control — driven in the browser
- [x] Return visit after a departure: counter reset, flag consumed,
      acknowledgement shown once, system running
- [x] `tsc --noEmit`, `eslint .`, `check:glyphs` (93 glyphs, 舰队 added),
      `next build`

## Not verified

**The ending arriving on its own.** The trigger is about 19 minutes of watching
away and the preview pane reports `document.hidden`, which freezes the
simulation, so the live path from a running system to a departure has not been
watched end to end. What was driven is the panel, both controls, and the return
visit — with the trigger temporarily forced and then reverted. Worth one real
session at `localStorage["trisolaris.civilization"] = 50` before this is
trusted.

## Considered and rejected

**A collision trigger.** Measured at zero occurrences in the shipping model,
and reachable only by exempting a falling world from the exposure death that
#17 established. See the two tables above.

**A bounded number of civilisations after which the system simply comes
apart** — the ticket's own fallback. Not needed: escape fires often enough that
a visitor past the gate sees it, and it has the virtue of being a real physical
event rather than a counter reaching a number. Worth revisiting only if the
ending should be guaranteed rather than likely.

---

# Review findings — 2026-09-10

Nine findings, all fixed. Every one was on the React side; the physics came
through clean. The critical one meant the ending had no working way out of it,
and the review was right that the browser session which claimed to have driven
it could not have caught it.

## 1. `beginAgain` restarted nothing — fixed

`tick` closed over the effect-local `const system` and never read
`systemRef.current`, which only `registerRenderer` read, once. So `beginAgain`
built a fresh system, put it in the ref, drew it a single time — and then
clearing `departedRef` let the loop resume **on the old, departed system**,
which repainted over it on the very next frame. The replacement was discarded.

What a visitor got: a counter reading `#1` over a simulation still at
civilisation 63, a hero going empty as the unbound world coasted off screen, a
page stuck red because `--heat` was still published from the old system, and a
counter that would jump to `#64` at that system's next collapse. The ending
could not even be reached again — the old system's `unboundFor` was already past
`UNBOUND_DWELL`, so the edge guard suppressed a re-fire.

**Resolution.** `tick` reads `systemRef.current` every frame. A swap is detected
by identity and resets the mirrors — `lastEra`, `lastCivilization`,
`lastStabilised`, `lastHeat` — which otherwise describe a system that is gone
and suppress every correction, since their whole job is to avoid republishing an
unchanged value.

**On the verification claim.** The PR said the exit *was* driven. What was
actually driven was the panel and the button with `departed` forced true in
`useState`: the single repaint at the end of `beginAgain` renders correctly for
exactly one frame, and the preview pane delivers no animation frames at all
(`document.hidden` is permanently true there), so nothing ever painted over it.
The claim outran the evidence.

## 2. The departure panel rendered on every route — fixed

`EraNotice` bails unless `pathname === "/"`, because only `/` renders Hero.
`Departure` had no such guard, so the ending's card sat over the résumé with
nothing on screen it referred to, and its `pointer-events-auto` swallowed clicks
through the middle of all four subpages. Same guard added.

## 3. Departure froze `--heat` at its Chaotic Era value, forever — fixed

`lost` can only fire while the era is chaotic, so heat had risen toward 1 by
then; zeroing `frames` stopped `advance`, so the decay never ran and the frozen
value was republished every frame. The site's ending rendered as a permanently
red, full-alarm page under the line *"The three suns go on without it, as they
did before anyone arrived."*

The review's framing is the right one: *"stopped where it ended" and "the suns go
on without it" are two different endings, and the copy is written for the one
that wasn't built.* So the built one changed rather than the copy.
`System.departed` now lives in the simulation: everything above the resolution
still runs — the suns integrate, trails record, ghosts fade, heat falls to
nothing — and everything that decides the fate of a civilisation is skipped,
because there is not one to decide. The world keeps coasting on the trajectory
that took it away and leaves the frame, which is what the prose says happens.

## 4. `returnedAfter` had two writers — fixed

The comment argued it must not go through the frame loop, because the loop does
not run under reduced motion or in a tab hidden at load. Then a frame-loop mirror
was added anyway, and `beginAgain` cleared only the state, not the ref. The
mirror and the ref are both gone: the microtask is the only writer, which is what
the comment always said it should be.

## 5. Departure did not break out of the current frame batch — fixed

`frames` is capped by `MAX_CATCHUP` at 30 sim frames, and the check sat before
the batch. A departure at frame 5 left 25 more to run, which could resolve the
era, push a collapse notice on top of the departure panel — `z-40` over `z-30` —
and write a civilisation the ending had already ruled out. The loop now breaks on
`departedRef.current`, and `System.departed` stops the simulation resolving
anything on later frames regardless.

## 6. The live region was mounted with its content — fixed

`if (!departed) return null` meant the region did not exist until the moment it
had something to say, and a region that appears with its content is generally not
announced. `EraNotice` already keeps its wrapper mounted and gates the inner
element; `Departure` now does the same, so the ending is announced rather than
being signalled only by a new button in the focus order.

## 7. `specificEnergy` did not match its own force law — fixed

The doc claimed the softening matched `computePlanetAcceleration`; it clamped `d`
instead, giving -5.77 at d = 0.1 where the integrator works in a well of -10.0.
The energy was therefore not conserved along the trajectory it measured, biasing
close passes toward "bound". Now `-1/sqrt(d^2 + PLANET_SOFTENING)`, the potential
whose gradient is that force law. It moves the trigger slightly — the shipped
rate is 9 events in 150 minutes rather than 11 — and the trigger fires far from
the suns where the two forms agree.

The review also noted that `fluxOn` squares `PLANET_SOFTENING` while the force law
does not, so all three disagreed about what the constant means. That one is left
alone deliberately, and now says so: flux feeds the exposure thresholds #17 swept
to choose `SCORCH_MULTIPLE` and `FREEZE_FRACTION`, and redefining it would move
every one of those numbers for no gain here.

## 8. The pacing rested on a 4-event sample — fixed

The body quoted a 150-minute run the committed harness could not reproduce, and
the row it did ship read `4 in 75 min` — a sample whose Poisson interval spans
one-per-7-minutes to one-per-70, presented in `DEPARTURE_AT`'s doc as a measured
fact a visitor's wait is budgeted against. The rate now has its own rig over
twice the seeds, and the shipped row is the number the design cites:
`9 in 150 min (one per 16.7 min)`. The whole harness still runs in 28 seconds.

## 9. Stray double blank line — fixed

`Footer.tsx`.

## On the design challenges

**The gate's layer.** The review is right that findings 3, 4 and 5 are all seams
at the boundary this change chose, and that is worth conceding rather than
arguing. The split is kept, because the testability it buys is real — one
`localStorage` number reaches the ending, and no simulation state has to be
forged — but the seam is narrower now: `System.departed` puts the *state* in the
simulation where the decay and the resolution live, while the *decision* stays
with the counter. That is what finding 3's fix actually was.

**A reset reachable only in the broken state.** Also right, and it is why the bug
survived. Not changed here: a reset offered against a healthy system is an
invitation to wipe an hour of someone's history, and the answer is a test rather
than a second button.

**Cross-tab disagreement.** Still true, and still unfixed: tab A departs and
writes the flag while tab B keeps writing the counter, so the next load reads two
facts that disagree. A `storage` listener would settle it. Recorded rather than
absorbed, since the ending is the one event this change wants to be durable.

## Still not verified

**The ending arriving and being left, in a live browser.** The preview pane never
delivers animation frames, so the loop only runs there under a hand-installed
timer, and background-tab throttling then slows it to a crawl. What was observed
under that shim: the departure fires, the panel appears, and `--heat` **decays**
from 0.33 to 0.31 while departed — which is finding 3's fix working, and could
not have happened before it. `Begin again` then clears the panel, resets the
counter to 1 and consumes the flag. What was *not* observed is the restarted
system going on to run a fresh Chaotic Era, which is the half of finding 1 that
only a real browser can show. It wants one session with
`localStorage["trisolaris.civilization"] = 50`.
