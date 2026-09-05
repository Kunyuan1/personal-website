# Review prompts

Copy one of these into a fresh chat opened in this repository. They are written
to be self-contained: a new session has none of the history that produced this
code, and the parts most worth checking are exactly the parts whose history
explains why they look the way they do.

Scope is deliberate. The `revamp-threebody` branch diff against `main` is a
whole-site rewrite, so an unscoped review buries the simulation in unrelated
markup.

---

# 1. The simulation

Paste everything in the block below.

````
/code-review high src/lib/trisolaris.ts src/components/EraProvider.tsx src/components/SystemCanvas.tsx

Review the Trisolaran simulation that drives this site's hero and colour
scheme. Read this whole brief before starting.

## What the code does

Three suns orbit under Newtonian gravity, with several massless planets. The
system alternates between a Stable Era (the suns run a genuine periodic
solution, so the orbit closes) and a Chaotic Era (they are perturbed and the
worlds are usually destroyed). When the home world dies, a civilisation counter
increments and a new system begins. The whole page's colour is driven from the
simulation's `heat` value.

Three files, with a strict separation:

- `src/lib/trisolaris.ts` — all physics and era state. No React, no DOM. This
  is where nearly everything worth reviewing lives.
- `src/components/EraProvider.tsx` — owns one System in a ref, runs the
  requestAnimationFrame loop, publishes `--heat` to the document, and syncs a
  little React state out of the simulation. It must never re-render at 60fps.
- `src/components/SystemCanvas.tsx` — a pure renderer. It registers a callback
  and draws whatever System it is handed. It owns no simulation state.

## Run these first, before reading any code

```
npm install
npm run sim:report      # the important one: ~1-2 min, 14 invariants
npx tsc --noEmit
npx eslint .
npx next build
```

`npm run sim:report` simulates 75 minutes across five fixed seeds and prints a
pass/fail table. It exits non-zero if any invariant fails. Everything below
that quotes a number came from it.

**Review against those numbers, not against your reading of the code.** This
simulation cannot be checked by inspection. A browser shows a few seconds of
one era; every bug that has actually occurred in this file only became visible
over tens of minutes of simulated time, and several were found precisely
because a measurement contradicted what the code plainly appeared to do.

## The invariants, and what each is protecting

Current values are from the committed baseline. A regression in any of these is
a blocking finding.

1. **No world may be destroyed during a Stable Era.** Now 0. A Stable Era is
   supposed to be the safe half of the cycle; a death there means an orbit was
   started from an unvalidated initial condition.
2. **Every collapse must begin a settle.** Now 0 skipped. If a path resets the
   system without one, the suns snap into place instead of orbiting back.
3. **Every destroyed world must leave a fading ghost.** Now 108/108. Otherwise
   a world and its trail vanish between two frames.
4. **Sun trails must survive a collapse.** Now 359 points immediately after.
   Clearing them makes the figure-eight blink out of existence.
5. **Suns stay within `SUN_ESCAPE_RADIUS`.** Now max 6.0. Beyond that they
   leave the frame and the hero looks empty.
6. **The home world holds its orbit through a Stable Era.** Now x1.034 of its
   own radius.
7. **No on-screen crossing faster than ~1s.** Now 3.47s worst. Faster than that
   reads as a teleport rather than motion.
8. **`pickFate` may only return a cause that is actually true of the state.**
   It is allowed to repeat rather than describe something that did not happen.
9. **Each periodic solution closes on itself.** Now 0.001 (figure-eight) and
   0.050 (moth) over whole periods.
10. **Entering a Chaotic Era must not kink the orbits.** Median per-frame
    velocity turn during the kick is 1.53 deg against 1.59 deg in a Stable Era
    — the perturbation should be invisible frame to frame.

## Check these hardest — each was already got wrong once

- **`fatesOf` and `describeFates`.** `drift` is a *description*, never a cause
  of death. Making it lethal killed worlds the moment they wandered: 104 deaths
  out of 119, and worse repetition than before the change. Confirm nothing has
  made it lethal again, and that `describeFates` only ever adds descriptions
  that hold.
- **`resetInto`.** An early return here once skipped the settle exactly when a
  sun had escaped — so the collapses most in need of a graceful recovery were
  the ones that cut. Confirm every path through it settles.
- **The settle branch of `advance`.** Only the shadow system may integrate.
  Letting the real bodies integrate as well let a sun leaving a close encounter
  reach 386 units against a limit of 6. The blend must stay a chase of a
  bounded target.
- **`timeScaleFor` and the sub-step loop.** The adaptive step must be
  re-evaluated *every sub-step*. Choosing a rate once per frame changed nothing
  measurable, because an encounter begins and ends inside one frame's 32
  sub-steps.
- **`EraProvider`.** Look for anything that would cause a React re-render per
  frame, and for state read from `localStorage` in a way that could differ
  between server and first client render.

## How to test a hypothesis

Do not reason a finding into existence. Measure it.

Write a scratch harness next to the existing one and run it directly:

```
node --experimental-strip-types --no-warnings scratch.mts
```

Import from `./src/lib/trisolaris.ts`, drive it with `advance(sys, 1, rand)`
using a seeded PRNG (copy `mulberry32` from `scripts/simulation-report.mts`),
and assert over tens of simulated minutes. `SIM_HZ` frames is one second.
Delete the scratch file afterwards.

If a finding cannot be demonstrated with a number, say so plainly and mark it
as a suspicion rather than a defect.

## Do not flag these — they are deliberate

Both are documented at the top of `trisolaris.ts`. Flag them only if the code
has drifted from what those comments claim.

- **The settle is not physics.** A chaotic three-body system never returns to a
  periodic orbit on its own. At the end of an era the suns chase a shadow
  system running the periodic solution. Everything *inside* an era is real
  integration.
- **Surviving worlds return to canonical starting angles**, not to where chaos
  left them. Stability depends on a world's phase relative to the suns, so an
  arbitrary angle is an unvalidated initial condition — measured, those wander
  far enough to die during the following Stable Era.
- **Causes repeat roughly 1 collapse in 7.** When the only true description of
  a death is the one just reported, it is reused rather than printing a false
  one.

## Known gap, worth attention

`syzygy` fires about 1 collapse in 90 and its transition has never been
observed running. It shares a code path with `fire`, but that is inference, not
evidence. If you can construct a seed or initial condition that triggers it
reliably, that is a genuinely useful contribution.

## When you are done

Write the review to `docs/reviews/YYYY-MM-DD-simulation.md` following
`docs/reviews/TEMPLATE.md`, then add a row to the index table in
`docs/reviews/README.md`.

Include the full `npm run sim:report` output so later reviews can diff against
it, and fill in the "considered and rejected" section for anything you tried
that did not hold up. That section is the reason these files are kept.
````

---

# 2. The site, excluding the simulation

````
/code-review medium src/app src/components/Nav.tsx src/components/PageHeader.tsx src/components/Carousel.tsx src/data

Review the pages and shared components of this Next.js portfolio, excluding
the physics simulation in src/lib/trisolaris.ts.

Run first:

```
npm run check:glyphs
npx tsc --noEmit
npx eslint .
npx next build
```

`check:glyphs` matters more than it looks. Every Chinese character used on the
site must appear in `CJK_GLYPHS` in `src/data/site.ts`, because the Noto Serif
SC webfont is subset to exactly those glyphs. A missing one does not error — it
silently falls back to whatever CJK font the visitor happens to have, or to
nothing. Seventeen glyphs were missing at one point with no visible symptom in
development.

Focus on:

- Accessibility: focus order, contrast, alt text, ARIA on the carousel, and
  whether anything conveys meaning by colour alone. The palette shifts red
  during a Chaotic Era, so check contrast holds at both ends — `--heat` 0 and 1.
- Responsive behaviour at 375px. No route may scroll horizontally.
- Next.js correctness: server/client boundaries, `next/image` usage, metadata.
- Whether the four pages have drifted apart in structure. They are meant to
  read as one set through `PageHeader`.

Write the review to `docs/reviews/YYYY-MM-DD-site.md` using
`docs/reviews/TEMPLATE.md` and add a row to the index in
`docs/reviews/README.md`.
````

---

# 3. Pre-deploy pass

````
/code-review high

Review the working diff before deploying.

Run all of these and treat any failure as blocking:

```
npm run sim:report
npm run check:glyphs
npx tsc --noEmit
npx eslint .
npx next build
```

Check in particular that no debugging leftovers survived: temporary constants,
commented-out code, `console.log`, `data-*` probes, or values that were pinned
during testing and never restored. Several constants in `trisolaris.ts` were
tuned by temporarily overriding them from the environment, so confirm none
still read `process.env`.

There is exactly one legitimate use of `process.env` under `src/` —
`NEXT_PUBLIC_SITE_URL` in `src/app/layout.tsx`. Anything else is a leftover.
````
