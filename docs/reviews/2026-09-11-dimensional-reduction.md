# Dimensional reduction — 2026-09-11

**Scope:** #13, on `main...dimensional-reduction`. The page starts flat.
**Harness:** unchanged at 43/43 — this touches no simulation code.

On a visitor's first ever visit the hero begins as a single luminous line, the
whole system compressed onto one row, and opens into three dimensions over two
seconds. Once, and never again. The page is not *showing* a flattened thing;
the page **is** it, and the system comes out of it.

## What the ticket asked for, and what it got instead

The original #13 wanted an overlay: a sequence with the Earth in it, a click to
dismiss, and its own state machine. The version here does none of that. It is a
render-only ramp threaded through machinery that already existed — the same
shape as `hydration`, which does the same job for rehydrations — plus one
notice kind. No overlay, no gate, nothing to dismiss.

That is the whole design argument: the site already had a way to say *this is
happening now*, and #13 did not need a second one.

## The mechanism

`Renderer` gained a third argument:

```ts
type Renderer = (system: System, hydration: number, rise: number) => void;
```

`rise` is 0 for flat and 1 for standing. `SystemCanvas` spends it on a single
transform wrapping the scene — not the ground, not the heat wash, which are the
page and do not move:

```ts
ctx.translate(0, centerY);
ctx.scale(1, Math.max(FLAT, rise));
ctx.translate(0, -centerY);
```

`FLAT` is 0.015 rather than 0, because `scale(1, 0)` is a singular matrix and
Canvas draws nothing through one. A flat system that renders as an empty page is
not the effect.

The physics cannot see any of this, which is the point of passing it rather than
storing it on the system.

### The ordering bug, found before it shipped

Deciding whether to start flat inside the provider's load effect put the first
frame out at `rise = 1`. `SystemCanvas` is a *child*, and child effects run
before parent effects — so it registered its renderer and drew one fully-formed
frame, and only then did the parent decide the system should have been flat. The
visitor saw the standing system, a collapse, and a rise.

It is decided in a lazy `useState` initialiser now, which runs during render and
therefore before any child effect. On the server it returns false, and nothing
it produces reaches the markup, so the two renders cannot disagree.

## The flat state was not luminous, and had to be made so

The ticket says "a single **luminous** line". Compressing a scene does not
concentrate its light: a sun's core is a 4.4px disc that goes sub-pixel under
the transform and antialiases *down*. Measured, the flat state peaked at
luminance **100** against the standing system's 255. A dimmer scene, not a
brighter line.

So the horizon is drawn, rather than hoped for — an ellipse under the same
additive compositing as the scene, outside the transform because it is already
flat and scaling it would collapse the one thing whose job is to be seen. It
fades out by `rise = 0.45`.

| rise | 0 | 0.05 | 0.1 | 0.2 | 0.3 | 0.45 | 1 |
|---|---|---|---|---|---|---|---|
| peak luminance | **174** | 189 | 228 | 244 | 252 | 255 | 255 |

Against a ground of 6, and monotone: the line opens into the scene rather than
dipping through a dim middle on the way.

## No white-out, as a measurement rather than an intention

The ticket forbids a white-out, and compressing the scene is a real way to cause
one — every trail and glow is stacked additively onto a handful of rows.

Measured as the share of pixels above luminance 245, the worst frame of the ramp
is **0.005%**, under the **0.013%** the standing system sits at anyway. So no
frame of the rise is more blown out than the page is when nothing is happening.

**Planted against a broken version first**, because a number with nothing to
compare it to proves nothing. A deliberately white horizon at full alpha
measures **0.464%** — ninety times the shipped figure — and it concentrates at
`rise = 0`, where the scene is compressed five times harder than at 0.1. That is
the risk sitting exactly where the argument says it should.

It also settled *which* number to watch: **peak luminance cannot see any of
this.** It reads 255 for the shipped version and 255 for the blown one. The
share-above-threshold is the measurement; the peak is not.

**This is a measurement, not a standing check.** The repo has no browser test
harness — `sim:report` and `check:glyphs` are both pure Node — and adding a
headless browser for one assertion is not proportionate. The method is written
down here so it can be re-run, and that is the honest description of it.

## The caption

A fourth `Notice` kind, `descent`, carrying no payload. The other three report
an outcome the visitor could not have predicted; this one names a thing they are
watching happen, and the only fact in it is that it is happening.

> 降维
> Everything here began flat — the whole system pressed onto a single line —
> and has just been given its dimensions back.
> *In the books, this only ever runs the other way.*

It goes up as the rise *begins*, not after it lands, because it is a caption and
not a report. `RISE_NOTICE_MS` is 9000: two of those seconds are spent with the
system still opening, leaving about seven to read two sentences.

`降` and `维` were restored to `CJK_GLYPHS`. Both were among the 20 orphans
removed in #12, and with the glyph check now enforcing, the build fails without
them. Subset back to 81 glyphs.

## Three ways the one-shot could have been quietly destroyed

Each of these was found by driving the real page, not by reading it.

**A deep link burned it.** `SystemCanvas` lives in `Hero`, and `Hero` renders on
`/` alone. A first-time visitor arriving at `/about` would mark themselves as
having seen the rise while there was no canvas on the page. `startFlat` now
requires `pathname === "/"`, and — the half that actually matters — `RISEN_KEY`
is claimed only when the rise *starts*, not when the provider mounts. A one-shot
marked used without being seen is a one-shot nobody ever gets.

Verified: loading `/about` with empty storage leaves `trisolaris.risen` unset,
and the next load of `/` plays it.

**A departure was outranked by a remount.** A departure acknowledgement and a
descent caption both appeared, stacked. Reading a departure *consumes* it —
`DEPARTED_KEY` is removed in the same breath — so under React's development
double-mount the second pass found no departure, recomputed the local that was
guarding on it, and re-armed the caption the first pass had correctly
suppressed. The signal lives in a ref now, which survives the remount.

Not a development-only concern dressed up as a real one: an effect that only
behaves when it runs exactly once is an effect with a latent bug in it.

**The guard was reading state that did not exist yet.** The first version of
that check read `returnedAfter`, which is published on a microtask and is still
null when the load effect runs. It would have suppressed nothing at all. `eslint`
flagged the missing dependency, which is how it was found — the warning was
correct, and the fix was not to add the dependency.

## Composition, driven rather than reasoned

| Storage state | Rise | Notice |
|---|---|---|
| Empty, on `/` | yes | 降维 |
| `lastSeen` 2h old, `risen` set | no | 冬眠, 2 hours, 204 civilisations |
| `departed=25`, `risen` absent | yes | departure only — caption stands down |
| Empty, on `/about` | no | none, and `risen` left unclaimed |

**One of these could not be tested by reloading**, which is worth writing down.
Setting `lastSeen` and then navigating fires `pagehide`, whose presence beat
rewrites `lastSeen` to now — so the test destroyed its own precondition and the
hibernation notice correctly did not fire. It reads as a regression and is the
mechanism working. Tested from a second tab, so the first never unloads.

## What was not verified

**Reduced motion.** `startFlat` returns false and the key is not claimed, so the
same person still meets the rise if they later open the site on a machine
without the setting — the setting asks not to be shown an animation, not to be
struck off the list of people who have seen one. Reasoned, not driven: this pane
cannot emulate `prefers-reduced-motion`.

**The rise at speed.** `RISE_MS = 2000` has never been watched. The preview pane
delivers **zero** animation frames — measured, not assumed — so the ramp can be
stepped and sampled but not played.

2000 is a choice, not a default. `REHYDRATION_MS` settled at 1500 as "the one
you cannot miss and do not wait through", and this wants to be slower: it runs
once, it carries a concept, and it has a caption to be read alongside. It also
holds the hero on someone's first visit, which is the worst moment to hold
anything — so it stays under the ~2.5s where an entrance starts feeling like a
gate. This is the one number in the feature that wants a human eye, the way
`REHYDRATION_MS` got one at 900, 1500 and 3000.
