# Kunyuan Hu — personal website

**Live: [kunyuan.vercel.app](https://kunyuan.vercel.app)**

My portfolio: projects, an about page, my résumé and how to reach me. It's built
around *The Three-Body Problem*: the home page runs a live simulation of the
Trisolaran system, with three equal-mass suns under Newtonian gravity and a
world trying to survive them.

## What's on it

- **Home**: the three-body simulation. The suns switch between Stable Eras, which
  follow a real periodic solution, and Chaotic Eras, where they're perturbed and
  the outer worlds get swallowed or thrown out. A counter tracks how many
  civilisations have risen and fallen while you watched.
- **Projects**: ClipFarm, Imposter, Medi-Cal Scheduling, Eric's Mansion and
  Worst Birthday UI, each with what it does, what it's built with, and a link
  to the code.
- **About**, **Résumé** (with a downloadable PDF) and **Contact**.

It's easier to see it than to read about it.

## Stack

Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4, deployed on
Vercel. The simulation is plain TypeScript drawn on a `<canvas>`, with no physics
or animation libraries.

## Running it locally

Needs Node 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Checks

The simulation can't be checked by looking at it. The failures that matter only
show up after tens of minutes of simulated time. So it has a deterministic test
harness. CI ([`.github/workflows/checks.yml`](.github/workflows/checks.yml)) runs
it on every pull request, along with the typecheck, lint, glyph check and build:

```bash
npm run sim:report     # 75 simulated minutes across fixed seeds; fails on any broken invariant
npm run check:glyphs   # every Chinese character on the site is in the font subset
npm run check:intro    # the arrival sequence's decision table
npx next typegen && npx tsc --noEmit
npx eslint .
npx next build
```

The reviews this codebase has been through, and the numbers behind them, are in
[`docs/reviews`](docs/reviews).

## Layout

```
src/app/         routes: home, projects, about, resume, contact, 404
src/components/  UI, plus the simulation canvas and era notices
src/lib/         the three-body integrator (trisolaris.ts) and canvas helpers
src/data/        site copy, projects, résumé and skills; edit these to change content
scripts/         the checks above
```
