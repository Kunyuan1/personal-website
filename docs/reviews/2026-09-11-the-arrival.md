# The arrival — 2026-09-11

**Scope:** #13, on `main...dimensional-reduction`.
**Harness:** unchanged at 43/43 — this touches no simulation code.
**Checks:** `tsc`, `eslint`, `check:glyphs` (79 glyphs), `next build` all clean;
every route still `○ (Static)`.

On a visitor's first ever visit the site opens on a black screen with a single
photon on it, and one line from the thing holding the photon. It sits there for
three seconds. Then the screen tears itself off the page in a glitch, collapses to
a band across the middle, and snaps out.

> 智子
> You see what we want you to see.

## Two versions this replaces

**A rise inside the canvas.** The *simulation* was compressed onto one row and
rose, while the page around it — nav, name, headline — stood there the whole
time. A picture of a flattened thing on a page, which is not the idea.

**A scale on the whole document.** Closer, and wrong in a more expensive way.
Every bug in this feature came from transforming the real page:

- `SystemCanvas` sized its backing buffer from `getBoundingClientRect()`, which
  reports the box *after* transforms. The attribute is stamped before `<body>`
  is parsed, so the canvas measured itself while the page was already flat:
  **1px tall against a layout height of 712.** It drew the entire three-body
  system into a one-pixel buffer, and nothing recovered it — a CSS animation
  ending fires no resize event, so the suns were gone for the rest of the visit.
- A finished `forwards` fill leaves `scaleY(1)`, and an identity transform is
  still a containing block for any `position: fixed` descendant. The attribute
  survives client-side navigation, so a visitor who unfolded on `/` and then hit
  the 404 would have carried that containing block onto a page that uses one.
- The sticky nav sat inside it.

The overlay has none of this. **The document is never touched.** It renders at
its natural size, the canvas measures correctly, and the simulation is already
running when the tear clears — visible in the reveal frames, mid-orbit.

Worth keeping separately from the feature: an intro that covers the page is
strictly cheaper than one that deforms it.

## The mechanism

A blocking script in `<head>` stamps `data-intro="on"` and claims the storage
key. The overlay is always in the markup and `display: none` unless that
attribute is set, so there is nothing for React to mount and nothing to flash.

It has to be a blocking script. The page is statically prerendered and arrives
fully formed, so a decision taken after hydration shows the finished page first
and *then* drops a black screen over it — a glitch, and not the intended kind.
Running before `<body>` is parsed means the first frame anyone sees is black.

It touches nothing React owns, so there is no hydration mismatch, and nothing to
tear down: the animation ends `visibility: hidden`. Verified — clicks at the
centre of the screen land on the page, not on the overlay.

## The photon

A point of light, not a sphere. The 404 already has a sophon, unfolded and
turning; two glowing spheres on one site is a repeat. A photon on its way here
has not been unfolded yet, so it is the one thing it can be — a proton, lit,
with nothing around it. Same object, two states, which is how the book has it.

The outer halo is a gradient rather than a third box-shadow. A 130px blur at
0.22 alpha over near-black steps through too few 8-bit values and the seams show
as a soft rectangle around the light — on a black screen held for three seconds
that is the first thing the eye finds. The first gradient replacement was worse:
0.2 alpha across 360px read as a *disc with an edge*, a bigger artefact than the
banding it replaced. It is now 0.072 peak across 520px, so the glow is gone long
before the gradient's own boundary.

## The line

Written in the site's voice rather than attributed. "You see whatever we want
you to see" is the right idea — it is the sophons' hold over what humans are
able to perceive — but quoting it would mean inventing a sentence and hanging
Liu Cixin's name on it. The site already writes its own copy in that register
("The system does not wait."), so this does too.

The words fade in after the photon rather than with it, so the photon is what
you see first and the line is what it then says.

## The tear

`steps(1, end)` is what makes it a glitch rather than a slide: every keyframe
snaps to its value and holds, so nothing is ever interpolated and the screen
jumps between discrete broken states.

`clip-path: inset()` cuts horizontal slabs out of the black, and the page —
which has been sitting there fully rendered the whole time — shows through the
gaps. It flickers back to whole twice on the way, because a tear that only ever
loses ground reads as a wipe.

It ends by collapsing to a band across the middle and snapping out, which is the
one thing worth keeping from the version before it: the screen leaves as a
horizontal line.

## Four ways the one-shot could have been quietly destroyed

Each spends the sequence on somebody who cannot see it, and each fails silently.

1. **A deep link.** Arriving at `/about` is not an arrival. Gated to `/`.
2. **A hidden tab.** Inline scripts run in hidden tabs; animations do not. A
   middle-clicked link would claim the key and animate nothing. Driven rather
   than reasoned — the preview pane reports `document.hidden: true` during
   loads, and the script demonstrably bails there.
3. **Reduced motion.** The key is deliberately *not* claimed. The setting asks
   not to be shown an animation, not to be struck off the list of people who
   have never seen one.
4. **No storage.** Refusing is the conservative failure for a one-off: better
   never than on every single visit.

## Replaying it

`/?intro=1` plays it again regardless of whether this browser has seen it. A
once-per-lifetime sequence that cannot be replayed is one nobody can judge, and
the alternative is clearing site storage by hand — which in Chrome means getting
past the console's paste guard first. It overrides the seen-already check and
nothing else.

## Review findings from the previous round

All six from PR #26 were fixed. Four are now moot, in code that no longer
exists. One survives, and is the most valuable thing on this branch:

**The reduced-motion hero never drew — and still did not after the obvious
fix.** The branch's only draw call had been silently dropped by a patch helper
with the signature `(from, to)` called with three arguments. Restoring it was
not sufficient: `resize()` assigns `canvas.width`, which clears the canvas even
when the value is unchanged, and `onResize` never repainted — so a
reduced-motion visitor, who has no frame loop, lost their hero to any resize.

Two production builds differing only in that fix: **0 lit pixels before, 71
after.** It predates the PR on `main`, and no check in the repo can see it —
React's development double-mount hides it by registering the renderer a second
time after `systemRef` is populated, so it draws in development and not in
production.

## Two near misses worth recording

Stripping the previous version used a range-cut between two anchors, and the
range swallowed the heat-publishing block — `--heat` would never have been set
and the entire era colour wash would have been dead. **`tsc` was clean and
`eslint` called it three warnings.** "All checks pass" would have shipped it.

And `check:glyphs` earned its keep again: removing the 降维 caption orphaned two
glyphs in the font subset, and the enforcing check failed the build until they
came out. 81 → 79.

## What was not verified

- **The sequence at real speed, by eye.** The preview pane reports
  `document.hidden: true` during loads, and hidden tabs do not advance CSS
  animations. Every frame above comes from seeking the real animations with the
  Web Animations API and screenshotting — exact, but not the same as watching
  it. `--intro-glitch` (560ms) still wants a human. `--intro-hold` has now had
  one: 3000ms, settled by eye against 2200 and 4000.
- **`prefers-reduced-motion` through the real media query**, rather than by
  forcing the branch in a production build.
