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

So the horizon is drawn, rather than hoped for — an ellipse, composited
additively so it *adds* to the squashed system rather than covering it, and
drawn outside the transform because it is already flat and scaling it would
collapse the one thing whose job is to be seen. It fades out by `rise = 0.45`.

Sized to the nearer edge rather than to the width, so it falls off inside the
frame on both sides; `centerX` is 0.73 of the width on the desktop layout, which
is not the middle.

| rise | 0 | 0.05 | 0.1 | 0.2 | 0.3 | 0.45 | 1 |
|---|---|---|---|---|---|---|---|
| peak luminance | **184** | 241 | 255 | 255 | 255 | 255 | 255 |

Against a ground of 6, and monotone: the line opens into the scene rather than
dipping through a dim middle on the way.

These numbers are the *second* set. The first read 174 and came from a horizon
that was silently compositing `source-over` — see finding 3 below.

## No white-out, as a measurement rather than an intention

The ticket forbids a white-out, and compressing the scene is a real way to cause
one — every trail and glow is stacked additively onto a handful of rows.

Measured as the share of pixels above luminance 245, the worst frame of the ramp
is **0.005%**, under the **0.013%** the standing system sits at anyway. So no
frame of the rise is more blown out than the page is when nothing is happening.
Unchanged by the switch to additive compositing, which moved the peak but not
the blown-pixel share.

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
> and is being given its dimensions back.
> *In the books, this only ever runs the other way.*

It goes up as the rise *begins*, not after it lands, because it is a caption and
not a report. `RISE_NOTICE_MS` is 9000: two of those seconds are spent with the
system still opening, leaving about seven to read two sentences.

`降` and `维` were restored to `CJK_GLYPHS`. Both were among the 20 orphans
removed in #12, and with the glyph check now enforcing, the build fails without
them. Subset back to 81 glyphs.

## Four ways the one-shot could have been quietly destroyed

Each of these was found by driving the real page, not by reading it. The fourth
came out of the review and has its own entry below — a tab hidden at load spent
the rise against animation frames that never arrived.

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
| Empty, tab hidden at load | no | none, and `risen` left unclaimed |

**One of these could not be tested by reloading**, which is worth writing down.
Setting `lastSeen` and then navigating fires `pagehide`, whose presence beat
rewrites `lastSeen` to now — so the test destroyed its own precondition and the
hibernation notice correctly did not fire. It reads as a regression and is the
mechanism working. Tested from a second tab, so the first never unloads.

A second trap of the same shape cost a round here: storage keys are per origin,
and the production build runs on a different port. Clearing storage while the
tab was still on one origin and then navigating to the other left the old keys
in place, and the run looked like a caption that had stopped appearing.

**Known and consistent:** a notice timer keeps running while a tab is hidden, so
someone who hides the tab mid-rise returns to a resumed rise whose caption has
expired. Every other notice behaves the same way, so this is left alone rather
than given special handling in shared machinery.

## Review findings

Six findings, two of them critical. Both criticals were in paths this document
had reasoned about rather than driven, which is exactly where it said the risk
was — and one of them was a straight regression against `main`.

### 1. The reduced-motion hero never drew (critical, and a regression)

`rendererRef.current?.(system, 1)` — the entire render path for a
reduced-motion visitor — had been replaced by a comment truncated mid-sentence.

The cause is worth recording, because it is a tooling failure rather than a
reasoning one. These edits are applied by a patch script whose helper takes
`(from, to)`; this call passed *three* arguments, and the third — which held the
replacement line — was silently dropped. The script reported "6 of 6" because
the swap did fire. It matched, replaced, and wrote the wrong thing, and the
count proved only that it had found its target.

**Restoring the line was necessary and not sufficient.** Driven in a production
build with `reduced` forced true, the canvas was *still* blank. The real cause
is one layer down: `resize()` assigns `canvas.width`, and assigning it clears
the canvas even when the value is unchanged — while `onResize` only re-measured.
A reduced-motion visitor's hero is painted exactly once, so the first resize
after load blanked it for good. At mount the same thing happens in miniature:
the first `resize()` can measure a canvas the layout has not placed yet, the
provider's draw lands in a 1x1 buffer, and the first real resize throws it away.

`onResize` now re-registers the renderer, which is the existing path that draws
immediately when a system exists. Two production builds differing only in that
change:

| | lit pixels | peak |
|---|---|---|
| draw call restored, `onResize` re-measuring only | **0** — blank | 0 |
| draw call restored, `onResize` re-registering | 71 | 255 |

Why it survived every check: React's development double-mount registers a second
time *after* `systemRef` is populated, so it draws in development and not in
production. `tsc`, `eslint`, `check:glyphs` and `next build` are all blind to it.

### 2. A tab hidden at load burned the one-shot (critical)

Effects run in hidden tabs; animation frames do not. A middle-clicked link or a
restored session set `riseStartRef`, claimed `RISEN_KEY` and queued the caption
against a rAF that fires whenever the visitor gets round to the tab — by which
point `t` is 15, the ramp snaps to 1 on the first painted frame, and the caption
describes a rise nobody saw. `visibilitychange` does not rescue it: there was no
hide *transition*, so `onVisibility` returns at `if (running) return`.

Two fixes, because there are two ways in:

- **Hidden at load**: `startFlat` now requires `!document.hidden`. Refusing to
  start beats deferring, and it is the rule the deep-link case already settled
  on — the rise is still theirs on the next visit they actually watch.
- **Hidden mid-rise**: `riseStartRef.current += away` in `onVisibility`,
  alongside the `hydrationStart += away` that was already there for exactly this
  gap.

Verified in the production build: with `document.hidden` true at load, no rise
runs, no caption appears, and `trisolaris.risen` is left unclaimed.

### 3. The horizon composited `source-over`, and not on purpose

`ctx.save()` is taken *before* the scene sets `lighter`, so `restore()` put
`source-over` back and the horizon painted over the squashed system rather than
adding to it. At alpha 0.78 it was occluding 78% of the thing this document
calls it the resting place of — so "it is not a trick standing in for the
squashed system" was, at rise 0, not true.

Set explicitly at the draw site now, with the dependency written down: moving
that `save()` two lines down is a natural tidy-up that would otherwise flip the
compositing and silently invalidate every number here. Peak at rise 0 went
174 to **184**; the blown-pixel share did not move.

### 4. The horizon ran off the right edge

`reach = width * 0.42` centred on `centerX`, which is `width * 0.73` on the
desktop layout — so the ellipse was cut by the canvas edge while the other side
faded out properly. Sized to the nearer edge now.

Planted against the old value, sampling the brightest pixel in the last column:

| rise | 0 | 0.1 | 0.3 | 0.45 | 1 |
|---|---|---|---|---|---|
| `width * 0.42` | **41** | 36 | 15 | 6 | 6 |
| nearer edge | 6 | 6 | 6 | 6 | 6 |

6 is the ground. The old version put a hard vertical line down one side for the
first 0.45 of the rise — the exact failure the comment claimed the ellipse was
chosen to avoid.

### 5 and 6 (nits)

The caption was past tense — "has just been given its dimensions back" — for
something shown on the tick the rise *starts*, contradicting both
`RISE_NOTICE_MS`'s justification and the design rule three lines above it in
`EraNotice`. It reads "is being given its dimensions back" now.

The hibernation block's comment had been orphaned by the rise block landing
between them, so a paragraph about measuring an absence sat on top of code that
starts a rise clock. Moved back onto its try-block.

### Design challenges

Two were taken. `departureSeenRef`'s comment now leads with the argument that
survives StrictMode being switched off — the local is per effect run and the
question is per visitor, and reading a departure destroys the evidence a second
run would need — with the dev double-mount kept as the symptom rather than the
reason.

The `[startFlat]` dependency stays listed rather than disabled, because it *is*
a real dependency and saying so is honest. The comment now carries the
consequence instead: this effect owns the system, the frame loop and every
storage key, so the invariant keeping it safe is the lazy initialiser and not
the array.

## What was not verified

**Reduced motion, as a media query.** The branch itself is driven now — forced
true in a production build, which is what found finding 1 and proved the fix —
but the pane cannot emulate `prefers-reduced-motion`, so the query reaching that
branch is still reasoned. The claim it carries, that `startFlat` returns false
and the key is not claimed so the same person meets the rise later on a machine
without the setting, follows from the same code path the deep-link and
hidden-tab cases were driven through.

**The rise at speed.** `RISE_MS = 2000` has never been watched. The preview pane
delivers **zero** animation frames — measured, not assumed — so the ramp can be
stepped and sampled but not played.

One thing lowers the stakes, from the review: with the hidden-tab fix the rise
only ever plays in a visible tab, so 2000 is a real 2000 rather than a number
that sometimes resolved to zero.

2000 is a choice, not a default. `REHYDRATION_MS` settled at 1500 as "the one
you cannot miss and do not wait through", and this wants to be slower: it runs
once, it carries a concept, and it has a caption to be read alongside. It also
holds the hero on someone's first visit, which is the worst moment to hold
anything — so it stays under the ~2.5s where an entrance starts feeling like a
gate. This is the one number in the feature that wants a human eye, the way
`REHYDRATION_MS` got one at 900, 1500 and 3000.
