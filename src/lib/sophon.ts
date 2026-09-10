/**
 * A sophon, unfolding.
 *
 * A proton is a point. Unfold it into two dimensions and it is vast — the
 * Trisolarans etched one into a supercomputer, folded it back down to nothing,
 * and fired it here at very nearly the speed of light to sit inside our
 * accelerators and make the answers lie. That is what a sophon is for: not
 * destruction, but a locked door. Humanity keeps running the experiment and
 * keeps getting nonsense back, and physics simply stops.
 *
 * Which is what a 404 is. Something unseen is standing between you and the
 * thing you were looking for, and no amount of asking again will get you there.
 *
 * The drawing problem is that a sophon is proton-sized and therefore invisible;
 * everything memorable about it is a symptom. This draws the one moment it was
 * ever visible from the ground — the unfolding, when it opened into a surface
 * that wrapped the sky, etched over every inch with circuitry, before folding
 * back to a point and disappearing into an accelerator.
 *
 * Like `canvas-ground.ts` says, an opaque canvas has to paint the page's own
 * background, so `ground` is taken rather than assumed.
 */

export type SophonOptions = {
  /** Centre, in canvas pixels. */
  x: number;
  y: number;
  /** The radius at full unfold. */
  radius: number;
  /**
   * 0 is a proton — a point, and nothing else on screen. 1 is the full sphere.
   *
   * Everything between is the moment the sky opened. The caller owns the
   * timing; this only knows how far open it is.
   */
  unfold: number;
  /** Rotation of the etched surface, in radians. */
  rotation: number;
  /** The page colour behind the canvas, `[r, g, b]`. See canvas-ground.ts. */
  ground: [number, number, number];
  alpha?: number;
};

/** The cool white every line on the surface is drawn in. */
const ETCH: [number, number, number] = [188, 211, 232];

/**
 * How far the pole is tilted toward the viewer, in radians.
 *
 * Not zero, because a sphere whose latitudes are straight lines reads as a
 * cylinder; not π/2, because concentric circles read as a target. About 22
 * degrees is enough to say "this is a globe seen slightly from above" with the
 * fewest lines.
 */
const TILT = 0.38;

const rgba = ([r, g, b]: [number, number, number], a: number) =>
  `rgba(${r}, ${g}, ${b}, ${a})`;

/** Smooth 0..1, so the sphere opens and closes without a corner. */
const ease = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

export function drawSophon(ctx: CanvasRenderingContext2D, options: SophonOptions) {
  const { x, y, radius, unfold, rotation, ground, alpha = 1 } = options;
  const open = ease(unfold);
  // Never quite zero: a folded sophon is still a proton sitting there, and the
  // page should have one point of light on it even at rest.
  const R = Math.max(1.2, radius * open);

  ctx.save();
  try {
    ctx.translate(x, y);

    // The interior. Barely lighter than the page — this is a surface catching
    // almost no light, not a planet.
    if (open > 0.01) {
      const face = ctx.createRadialGradient(0, -R * 0.25, 0, 0, 0, R);
      face.addColorStop(0, rgba(ground, 0.9 * alpha));
      face.addColorStop(0.75, rgba(ground, 0.72 * alpha));
      face.addColorStop(1, rgba(ground, 0.4 * alpha));
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // The etching, clipped to the sphere.
    //
    // A grid of right angles rotating behind the silhouette: circuitry too
    // large to see the whole of, which is the thing the sky looked like for the
    // few minutes it was open. Drawn first so the wireframe sits over it.
    if (open > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.rotate(rotation * 0.6);
      ctx.strokeStyle = rgba(ETCH, 0.14 * alpha * open);
      ctx.lineWidth = Math.max(0.5, R * 0.006);
      const step = R * 0.26;
      ctx.beginPath();
      for (let i = -6; i <= 6; i++) {
        const o = i * step;
        // Traces that turn a corner, rather than a plain grid: a grid reads as
        // graph paper and this has to read as something printed.
        ctx.moveTo(-R * 1.4, o);
        ctx.lineTo(o * 0.6, o);
        ctx.lineTo(o * 0.6, R * 1.4);
        ctx.moveTo(o, -R * 1.4);
        ctx.lineTo(o, -o * 0.6);
        ctx.lineTo(R * 1.4, -o * 0.6);
      }
      ctx.stroke();
      ctx.restore();
    }

    // The wireframe: latitudes, then meridians.
    //
    // Orthographic, with the pole tilted by TILT. A latitude at angle phi is an
    // ellipse of half-width R cos(phi), squashed vertically by sin(TILT) and
    // pushed up the screen by cos(TILT) — which degenerates correctly at both
    // ends, to straight lines pole-on and to concentric circles pole-up.
    if (open > 0.03) {
      ctx.lineWidth = Math.max(0.5, R * 0.004);

      for (let i = 1; i < 6; i++) {
        const phi = (i / 6) * Math.PI - Math.PI / 2;
        const rx = R * Math.cos(phi);
        const ry = rx * Math.sin(TILT);
        const cy = -R * Math.sin(phi) * Math.cos(TILT);
        // Latitudes fade toward the poles, where they crowd together and would
        // otherwise read as a solid band.
        ctx.strokeStyle = rgba(ETCH, 0.11 * alpha * open * Math.cos(phi));
        ctx.beginPath();
        ctx.ellipse(0, cy, rx, Math.max(0.4, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < 9; i++) {
        const lambda = (i / 9) * Math.PI * 2 + rotation;
        const rx = Math.abs(Math.cos(lambda)) * R;
        // A meridian edge-on is a line, not an ellipse of zero width; skip the
        // ones that would be sub-pixel rather than drawing a bright seam.
        if (rx < R * 0.04) continue;
        ctx.strokeStyle = rgba(ETCH, 0.09 * alpha * open * Math.abs(Math.cos(lambda)));
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, R, TILT * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      // The silhouette, brightest of all: the edge of the thing against the
      // sky, which is the only part anyone on the ground could actually resolve.
      ctx.strokeStyle = rgba(ETCH, 0.42 * alpha * open);
      ctx.lineWidth = Math.max(0.6, R * 0.005);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The proton. Always drawn, at every stage of the unfolding, because it is
    // the thing that unfolded — and when the sphere has folded away this single
    // point is all that is left on the page.
    const core = Math.max(1, radius * 0.008);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, core * 6);
    halo.addColorStop(0, rgba(ETCH, 0.85 * alpha));
    halo.addColorStop(0.3, rgba(ETCH, 0.22 * alpha));
    halo.addColorStop(1, rgba(ETCH, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, core * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgba([255, 255, 255], alpha);
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, Math.PI * 2);
    ctx.fill();
  } finally {
    ctx.restore();
  }
}
