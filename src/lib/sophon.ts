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
 * ## It does not paint a background
 *
 * This canvas is transparent and sits above `.era-wash`, so there is nothing to
 * repaint and never was. The rule `canvas-ground.ts` carries is for the *opaque*
 * canvas, which has to reproduce the page underneath it.
 *
 * The first version took a `ground` colour and filled the interior with it at
 * 90% alpha, which knocked nine tenths of the wash out and replaced it with a
 * colour that had none of it. At heat 1 the page behind read about
 * `rgb(57, 23, 20)` and the sphere about `rgb(30, 11, 11)`: a dark disc punched
 * out of a red page, which is exactly the failure the ground table exists to
 * prevent.
 *
 * So the interior is drawn **additively**. A surface catching almost no light
 * is a lightening of whatever is behind it rather than a repaint of it, and
 * lightening is correct at every heat for free — the void shows through when
 * the page is cold, the wash shows through when it is hot, and this module
 * never has to know which.
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
  /** Rotation of the wireframe, in radians. The etching lags it — see below. */
  rotation: number;
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

/**
 * The etched surface turns this much slower than the wireframe.
 *
 * Deliberate parallax rather than a stray constant: the circuitry is printed on
 * a curved surface and should not track the mesh that describes that surface.
 * Named so that the caller's `TURN_SECONDS` means one period rather than two —
 * the wireframe's is that, and the etching's is that divided by this.
 */
const ETCH_PARALLAX = 0.6;

const rgba = ([r, g, b]: [number, number, number], a: number) =>
  `rgba(${r}, ${g}, ${b}, ${a})`;

/** Smooth 0..1, so the sphere opens and closes without a corner. */
const ease = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

export function drawSophon(ctx: CanvasRenderingContext2D, options: SophonOptions) {
  const { x, y, radius, unfold, rotation } = options;
  const open = ease(unfold);
  // Never quite zero: a folded sophon is still a proton sitting there, and the
  // page should have one point of light on it even at rest.
  const R = Math.max(1.2, radius * open);

  ctx.save();
  try {
    ctx.translate(x, y);

    // The interior: a lightening, never a fill. See the note at the top — an
    // opaque face was a hole punched in the page at every heat above zero.
    if (open > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      const face = ctx.createRadialGradient(0, -R * 0.25, 0, 0, 0, R);
      face.addColorStop(0, rgba(ETCH, 0.05 * open));
      face.addColorStop(0.7, rgba(ETCH, 0.022 * open));
      face.addColorStop(1, rgba(ETCH, 0));
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // The etching, clipped to the sphere.
    //
    // A grid of right angles turning behind the silhouette: circuitry too large
    // to see the whole of, which is what the sky looked like for the few
    // minutes it was open. Drawn first so the wireframe sits over it.
    if (open > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.rotate(rotation * ETCH_PARALLAX);
      ctx.strokeStyle = rgba(ETCH, 0.14 * open);
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
        ctx.strokeStyle = rgba(ETCH, 0.11 * open * Math.cos(phi));
        ctx.beginPath();
        ctx.ellipse(0, cy, rx, Math.max(0.4, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Meridians, traced in the same projection rather than drawn as ellipses.
      //
      // `ctx.ellipse` with a constant rotation is a different projection: it
      // sends every meridian through a point 0.147R from where the latitude
      // rings converge — about 17px on the 256px canvas — and leans the whole
      // fan one way, where a real globe's meridians are mirror-symmetric about
      // the vertical. That mismatch is part of why the mesh read as a leaning
      // wireframe rather than as a sphere.
      for (let i = 0; i < 9; i++) {
        const lambda = (i / 9) * Math.PI * 2 + rotation;
        const facing = Math.abs(Math.cos(lambda));
        // Edge-on a meridian is a line, not a bright seam; skip it.
        if (facing < 0.04) continue;
        ctx.strokeStyle = rgba(ETCH, 0.09 * open * facing);
        ctx.beginPath();
        for (let k = 0; k <= 64; k++) {
          const phi = (k / 64) * Math.PI * 2;
          const px = R * Math.cos(phi) * Math.cos(lambda);
          const py =
            -R *
            (Math.sin(phi) * Math.cos(TILT) +
              Math.cos(phi) * Math.sin(lambda) * Math.sin(TILT));
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // The silhouette, brightest of all: the edge of the thing against the
      // sky, which is the only part anyone on the ground could actually resolve.
      ctx.strokeStyle = rgba(ETCH, 0.42 * open);
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
    halo.addColorStop(0, rgba(ETCH, 0.85));
    halo.addColorStop(0.3, rgba(ETCH, 0.22));
    halo.addColorStop(1, rgba(ETCH, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, core * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, Math.PI * 2);
    ctx.fill();
  } finally {
    ctx.restore();
  }
}
