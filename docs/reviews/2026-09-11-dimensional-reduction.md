# Dimensional reduction — 2026-09-11

**Scope:** #13, on `main...dimensional-reduction`. The page arrives flat.
**Harness:** unchanged at 43/43 — this touches no simulation code.
**Checks:** `tsc`, `eslint`, `check:glyphs` (81 glyphs), `next build` all clean;
every route still `○ (Static)`.

On a visitor's first ever visit the whole document arrives as a single luminous
line across the middle of the screen and opens into three dimensions over
1.5 seconds. Nav, name, headline, links, the simulation — one flattened plane,
opening. Once, and never again.

## The version this replaces

The first implementation put the effect inside the canvas: the *simulation* was
compressed onto one row and rose, while the page around it stood there the whole
time. That is a picture of a flattened thing on a page, which is not the same
idea and is a good deal less interesting than it. The whole point of 降维 is that
the space itself loses a dimension, and a nav bar sitting upright through it
gives the game away.

So the effect moved out of the canvas and onto the document, and the canvas went
back to what it was on `main`. Everything below describes the second version.
The first one is in the history at `f612b51`/`d34fa37` if the reasoning is ever
wanted.

## The mechanism

`Nav`, `main` and `Footer` are wrapped in `.unfold-root` and scaled about the
centre of the viewport:

```css
.unfold-root { transform-origin: 50% 50svh; }

html[data-unfold="flat"] .unfold-root {
  animation: unfold-page var(--unfold-ms) cubic-bezier(0.45, 0, 0.55, 1) backwards;
}
```

Three things stay deliberately **outside** the wrapper:

- `.era-wash`, the ground. It is what the page is pressed onto, and a horizon
  that collapses along with the thing resting on it is not a horizon.
- `EraNotice`, which carries the caption. It has to stay legible while the page
  it is describing is still a line.
- `Departure`, for the same reason.

The luminous line is a real fixed-position element rather than anything the
canvas paints — the canvas is inside the wrapper and is being squashed with
everything else, so a line drawn in there would be squashed too.

`scaleY` bottoms out at 0.0016 rather than 0. A zero scale is a singular matrix;
the compositor is entitled to drop the layer rather than draw a line, and it
would take the page's light with it.

## Why the decision is a blocking script and not React

The site is statically prerendered and the HTML arrives fully formed. Any
decision taken after hydration shows the finished page for a few hundred
milliseconds and *then* collapses it, which is a glitch rather than an effect.

So the decision is an inline script in `<head>`, which runs before `<body>` is
parsed. It stamps one data attribute on the document element and claims the
storage key; React's only job is the caption. Verified against the served HTML:
the script sits at byte 5208 and `<body>` at 5338.

It touches nothing React owns, so there is no hydration mismatch to reason
about.

## The finished animation leaves nothing behind

`animation-fill-mode` is `backwards`, and there is no standing `transform`
declaration to go with it. The from-state applies from the first style
resolution — so there is no frame in which the page paints unflattened — and
once the animation is over the element keeps **no transform at all**.

That is not tidiness. A `forwards` fill holds `scaleY(1)`, and an identity
transform is still a containing block for any `position: fixed` descendant. The
attribute survives client-side navigation, so a visitor who unfolded on `/` and
then hit a 404 — which *does* use fixed positioning — would have carried that
containing block onto it.

The first version instead cleared the attribute from an `animationend` listener.
That works when the event fires, and the event needs a frame. Ending with no
transform means nothing has to be cleaned up and nothing depends on an event at
all. Measured after `finish()`: `transform: none`, nav still `sticky` at top 0.

## The easing, measured rather than chosen

The obvious pick for "opening" is a strong ease-out. Measured across the
timeline, `cubic-bezier(0.16, 1, 0.3, 1)` was:

| % of duration | 10% | 25% | 50% | 75% | 90% |
| --- | --- | --- | --- | --- | --- |
| expo-out `(0.16,1,0.3,1)` | **0.50** | 0.83 | 0.97 | 1.00 | 1.00 |
| symmetric `(0.45,0,0.55,1)` | 0.02 | 0.12 | 0.50 | 0.88 | 0.98 |

Half open at a tenth of the duration and 97% at half of it: the visible motion
was over in about 400ms and the remaining 1100ms was imperceptible creep from
0.97 to 1. It would have read as a snap, and raising `--unfold-ms` would not
have fixed it — the curve was the problem. The line's own fade inherited the
same curve and dropped to 0.57 opacity within 150ms, before anyone could
register it as a line.

The symmetric curve uses the whole duration: the page holds as a line long
enough to be read as one, opens through the middle, and settles. The line now
holds full brightness through the first quarter and is gone by 70%, on `linear`
timing so the fade is even.

Shipped as measured, at `--unfold-ms: 1500ms`:

| % | 0 | 10 | 25 | 50 | 75 | 90 | 100 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scaleY` | 0.002 | 0.019 | 0.122 | 0.501 | 0.880 | 0.982 | 1.000 |
| line opacity | 1.00 | 1.00 | 1.00 | 0.44 | 0.00 | 0.00 | 0.00 |

## Four ways the one-shot could have been quietly destroyed

Each of these spends the effect on somebody who cannot see it, and each fails
silently — the visitor simply never gets it, and nothing anywhere reports that.

1. **A deep link.** `Hero` renders on `/` alone. A first-timer arriving at
   `/about` would have burned it on a page with nothing to unfold.
2. **A hidden tab.** Effects and inline scripts run in hidden tabs; animations
   do not. A middle-clicked link would have claimed the key and animated
   nothing. The script refuses, and the visitor keeps it for a visit they watch.
3. **Reduced motion.** The key is deliberately *not* claimed here. The setting
   asks not to be shown an animation, not to be struck off the list of people
   who have never seen one.
4. **No storage.** Refusing is the conservative failure for a one-off: better
   never than on every single visit.

## The caption

A fourth `Notice` kind, `descent`, through the panel the site already uses for
this. It carries no payload: the other three report an outcome the visitor could
not have predicted, and this one names a thing happening in front of them.

> 降维
> This page arrived flat — the whole of it pressed onto a single line — and is
> being given its dimensions back.
> *In the books, this only runs the other way.*

Present progressive, because it goes up as the page opens rather than after it
lands. `UNFOLD_NOTICE_MS` is 9s and is deliberately **not** tied to
`--unfold-ms`: one is how long the page takes to open, the other is how long the
words stay legible afterwards, and binding them would mean a faster unfold
silently became a caption nobody could finish.

It stands down if a departure was acknowledged on the same load. By construction
that cannot happen — a departure needs a previous visit — but storage can be
cleared a key at a time, so the precedence is written down rather than assumed.

## Review findings

Six were raised on PR #26. All six were fixed; two were then superseded when the
effect moved out of the canvas.

### 1. The reduced-motion hero never drew — critical, and a regression

The reduced-motion branch's only draw call had been replaced by a comment
truncated mid-sentence. Cause: a patch helper with the signature `(from, to)`
called with three arguments — the third held the replacement line and was
silently dropped. The script reported "6 of 6" because the swap *did* fire.

**This one went deeper than the review stated.** Restoring the line was not
sufficient. Driven in a production build with the setting forced on, the canvas
was *still* blank, because `resize()` assigns `canvas.width` — which clears the
canvas even when the value is unchanged — and `onResize` never repainted. A
reduced-motion visitor has no frame loop to repaint for them, so any resize
blanked the hero permanently, and at mount the first `resize()` can measure a
canvas the layout has not placed yet, leaving the provider's draw in a 1×1
buffer that the first real resize throws away.

Fixed by re-registering the renderer on resize, which already draws immediately
when a system exists. Both halves are needed: a canvas correctly sized at mount
never fires a resize at all.

Two production builds differing only in that change: **0 lit pixels before, 71
after.** This is the one finding that survives the redesign unchanged, and it is
a bug that predates this PR on `main`.

### 2. A tab hidden at load burned the one-shot — critical

`riseStartRef` was wall-clock and never pushed across a hidden interval, while
the key was claimed unconditionally. Confirmed and fixed, then superseded: the
CSS version has no clock to push, and the head script refuses outright. The
preview pane reports `document.hidden: true` during loads, which is how the
guard got driven rather than reasoned — the script demonstrably bails there.

### 3 and 4. The horizon composited `source-over`; the horizon ran off the right edge

Both confirmed and both fixed. `ctx.save()` was taken before the scene set
`lighter`, so `restore()` reverted it and the horizon was *occluding* 78% of the
system it claimed to be the resting place of. And with `reach = width * 0.42`
centred at `width * 0.73`, the last column of the canvas measured luminance 41
against a ground of 6 — a hard vertical cut down one side, held for the first
45% of the rise, which was the exact failure the comment claimed the ellipse was
chosen to avoid.

Both are now moot: the canvas-drawn horizon is gone, and the line is a page-level
element that spans the frame by construction. Recorded because the compositing
one is a good trap — the numbers in that doc block were all measured under the
wrong composite op and looked entirely reasonable.

### 5 and 6. Nits

The caption was past tense for something still happening; fixed, and the copy
survived the redesign. An orphaned hibernation comment had been separated from
its try-block by an insertion; re-paired.

### Design challenges

The `departureSeenRef` rationale was rebalanced to lead with the lifetime
argument — a per-effect-run local answering a per-visitor question — with the
development double-mount kept as how it surfaced rather than why it is wrong.

The reviewer suggested an eslint-disable over a `[startFlat]` dependency. That
dependency no longer exists, but the effect is now genuinely mount-once and is
marked as such, with the reason stated: it builds the system, owns the frame
loop and reads every storage key, so anything that made its inputs reactive
would tear all of that down to change a render ramp.

## A near miss worth recording

Stripping the rise machinery used a range-cut between two anchors, and the range
swallowed the heat-publishing block — `--heat` would never have been set and the
entire era colour wash would have been dead. **`eslint` reported this as three
warnings, not errors, and `tsc` was clean.** "All checks pass" would have
shipped it. Caught by reading the diff.

This is the second time in two sessions a patch script has silently done
something other than what it reported.

## What was not verified

- **The unfold at shipped speed, by eye.** The preview pane reports
  `document.hidden: true` during loads, and hidden tabs do not advance CSS
  animations. Every number above comes from seeking the animation deterministically
  with the Web Animations API, which is exact but is not the same as watching it.
  `--unfold-ms: 1500ms` is the one value that wants a human.
- **The caption end to end.** Its wiring is verified by inspection; it could not
  be driven in the pane, because the script correctly refuses to unfold there.
- **`prefers-reduced-motion` through the real media query.** Driven by forcing
  the branch in a production build, not by changing the OS setting.
