/**
 * The colour the page is behind a canvas, at a given heat.
 *
 * Every opaque canvas on this site has to repaint the page's own background, or
 * it stays a cold rectangle while everything around it goes red. `SystemCanvas`
 * has carried that rule in a comment since it was written — *"these must match
 * `--void` in globals.css for the two eras"* — and then the second canvas in the
 * repo was written without it, because the rule lived in the file that already
 * obeyed it.
 *
 * So it lives here, with both callers importing it. A third canvas gets the
 * invariant for free rather than inheriting the bug.
 */
export const CANVAS_GROUND = {
  stable: [5, 6, 10],
  chaotic: [27, 10, 10],
} as const;

/** The ground at `heat` in 0..1, as `[r, g, b]`. */
export function groundFor(heat: number): [number, number, number] {
  const warmth = Math.max(0, Math.min(1, heat));
  const cold = CANVAS_GROUND.stable;
  const hot = CANVAS_GROUND.chaotic;
  return [
    Math.round(cold[0] + (hot[0] - cold[0]) * warmth),
    Math.round(cold[1] + (hot[1] - cold[1]) * warmth),
    Math.round(cold[2] + (hot[2] - cold[2]) * warmth),
  ];
}

/**
 * `--heat` as the page currently has it.
 *
 * For a canvas that is not subscribed to the simulation. `EraProvider` publishes
 * this property on the document element on every route, quantised to 1%, so
 * reading it is how a component can warm with the page without importing the
 * three-body problem to do it.
 */
export function heatFromDocument(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--heat");
  const heat = Number.parseFloat(raw);
  return Number.isFinite(heat) ? Math.max(0, Math.min(1, heat)) : 0;
}
