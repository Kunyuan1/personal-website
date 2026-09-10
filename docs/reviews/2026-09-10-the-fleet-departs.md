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
