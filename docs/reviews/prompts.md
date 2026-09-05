# Review prompts

Paste one of these. They are scoped deliberately: the branch diff against
`main` is a whole-site rewrite, so an unscoped review drowns the simulation in
unrelated markup.

---

## The simulation (the one that matters)

```
/code-review high src/lib/trisolaris.ts src/components/EraProvider.tsx src/components/SystemCanvas.tsx
```

Then paste this as context:

> Focus on the era cycle and its transitions. There are five disasters — fire,
> cold, starless, syzygy, drift — and each has to enter and leave a Chaotic Era
> without a visible cut.
>
> Run `npm run sim:report` first and review against its numbers rather than
> reasoning from the code. It simulates 75 minutes and checks 14 invariants.
>
> Invariants that must hold:
> 1. A world may never be destroyed during a Stable Era. Currently 0.
> 2. Every collapse must begin a settle — no path may reset the system without
>    one. Currently 0 skipped.
> 3. Every destroyed world must leave a fading ghost, never disappear between
>    frames. Currently 108/108.
> 4. Sun trails must survive a collapse. Currently 359 points immediately after.
> 5. Suns must stay within SUN_ESCAPE_RADIUS. Currently max 6.0.
> 6. The home world must hold its orbit through a Stable Era. Currently x1.034.
> 7. No on-screen crossing faster than ~1s. Currently 3.47s worst.
> 8. `pickFate` must only ever return a cause that is actually true of the
>    state. It may repeat rather than lie.
>
> Three specific things to check hard, because each was already got wrong once:
>
> - **`describeFates` / `fatesOf`.** `drift` is descriptive only. Making it a
>   lethal condition killed worlds the moment they wandered — 104 deaths out of
>   119. Confirm nothing has made it lethal again.
> - **`resetInto`.** An early return here once skipped the settle exactly when a
>   sun had escaped, so the collapses most needing a graceful recovery were the
>   ones that cut. Confirm every path settles.
> - **The settle loop in `advance`.** Only the shadow may integrate. Letting the
>   real bodies integrate too let a sun reach 386 units against a limit of 6.
>
> Also worth questioning: the narrative devices are deliberate but should be
> called out if they have grown beyond what the comments claim — the settle
> re-seed, and worlds returning to canonical angles rather than where chaos
> left them.
```

---

## The site, excluding the simulation

```
/code-review medium src/app src/components/Nav.tsx src/components/PageHeader.tsx src/components/Carousel.tsx src/data
```

> Accessibility, responsive behaviour, and Next.js correctness. Run
> `npm run check:glyphs` — every Chinese character must be in the font subset
> or it silently falls back to whatever the visitor has installed. Confirm no
> route overflows horizontally at 375px.

---

## Everything before deploying

```
/code-review high
```

> Reviews the working diff. Run `npm run sim:report`, `npm run check:glyphs`,
> `npx tsc --noEmit`, `npx eslint .` and `npx next build` first, and treat any
> failure as a blocking finding.
