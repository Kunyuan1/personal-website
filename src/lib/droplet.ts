/**
 * The droplet, drawn on a 2D canvas.
 *
 * A probe with a perfectly reflective surface: a rounded head drawn out to a
 * point, and nothing on it but the light it is reflecting. In the books that
 * mirror finish is the whole horror of the thing — it arrives looking like a
 * blessing, because it is beautiful and it is smooth and nothing that beautiful
 * has ever been a weapon.
 *
 * Here rather than inside a component because there will be two callers: the
 * 404, which draws one large and slowly turning on an empty page, and the
 * droplet cursor (#10), which draws one small under the pointer on a page that
 * is already busy. Same object, so the same code decides what it looks like.
 *
 * It knows nothing about the simulation. It takes light *directions*, not sun
 * positions, so a caller with three real suns can hand it their angles and a
 * caller with none — the 404, where the system is deliberately not on screen —
 * can invent three and get the same object back.
 *
 * ## What rotates, and what does not
 *
 * This is a mirror, so most of it does **not** turn with the object:
 *
 *   - The **sky** — the body gradient and the sheen — is the reflected world,
 *     and the world does not spin because the drop does. It is drawn under a
 *     counter-rotation so it stays put while the silhouette turns through it.
 *   - A **specular highlight** stays in the direction of its light, which is
 *     what a curved mirror does and why a rotating chrome sphere looks static.
 *   - What moves is the **distance** each highlight sits from the centre, and
 *     its size, because the boundary in that direction moves: a droplet is not
 *     a sphere, and when the tail sweeps past a sun the reflection of that sun
 *     stretches out along it.
 *
 * The first version placed highlights at `light.angle - rotation` inside a
 * context already rotated by `rotation`, which composes to `light.angle`
 * exactly — the two cancelled to six decimal places, the highlights were nailed
 * to the page, and the file claimed the opposite in a comment. The angle was
 * right for the wrong reason; the radius is what was missing.
 */

/** Where a light is, and what colour it burns. Angles are world-space radians. */
export type DropletLight = {
  angle: number;
  /** Any CSS-ish colour this module can parse: `#rgb`, `#rrggbb`, `rgb(...)`. */
  color: string;
  /** 0..1. The three suns are not equally bright from where the droplet is. */
  strength: number;
};

export type DropletOptions = {
  /** Centre of the head, in canvas pixels. */
  x: number;
  y: number;
  /** Tip to the far side of the head. The head's radius is derived from it. */
  length: number;
  /** Where the tip points, in radians. 0 is up. */
  rotation: number;
  lights: DropletLight[];
  /**
   * The colour of the page behind the canvas, `[r, g, b]`.
   *
   * The body is built from this rather than from fixed hex, because the page
   * goes red during a Chaotic Era and an opaque object painted cold stays a
   * cold hole in a warm page — the exact failure `canvas-ground.ts` exists to
   * stop happening a second time.
   */
  ground: [number, number, number];
  /** 0..1, for fading the whole object in. Defaults to 1. */
  alpha?: number;
};

/**
 * The head's **radius**, as a fraction of the total length.
 *
 * So the head spans `[-0.42L, +0.42L]` — a diameter of `0.84L` — and the tail
 * is the remaining `0.16L` drawn out to the tip. It is a mostly-round object
 * with a point on it, not the 42/58 split the fraction reads like at a glance.
 * Anyone tuning this for a small cursor droplet should know which way it moves:
 * larger is rounder, not pointier.
 */
const HEAD = 0.42;

/** What the sky lifts the body toward — the same cool white the home world is. */
const SKY: [number, number, number] = [188, 211, 232];

/**
 * `[r, g, b]` from `#rgb`, `#rrggbb`, `#rrggbbaa` or `rgb()/rgba()`.
 *
 * Because `DropletLight.color` is a string on a shared module whose second
 * caller does not exist yet. The first version interpolated `${color}66` into a
 * gradient stop, which requires 6-digit hex and throws `SyntaxError` on
 * anything else — inside the clipped section, so the throw escaped with the
 * clip and `globalCompositeOperation: "lighter"` still set on the context.
 * Every later draw on that canvas would have been clipped to a droplet-shaped
 * hole and composited additively: silent corruption, not a visible crash.
 */
function toRgb(color: string): [number, number, number] {
  const hex = color.trim();
  if (hex.startsWith("#")) {
    const body = hex.slice(1);
    const full =
      body.length === 3 || body.length === 4
        ? body
            .slice(0, 3)
            .split("")
            .map((c) => c + c)
            .join("")
        : body.slice(0, 6);
    const n = Number.parseInt(full, 16);
    if (full.length === 6 && Number.isFinite(n)) {
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
  }
  const parts = hex.match(/-?\d+(\.\d+)?/g);
  if (parts && parts.length >= 3) {
    return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  }
  // Unparseable: the sky, so a bad colour is a dim highlight rather than a
  // corrupted canvas.
  return SKY;
}

const rgba = ([r, g, b]: [number, number, number], a: number) =>
  `rgba(${r}, ${g}, ${b}, ${a})`;

/** `base` moved a fraction of the way toward `toward`. */
function lift(
  base: [number, number, number],
  toward: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(base[0] + (toward[0] - base[0]) * t),
    Math.round(base[1] + (toward[1] - base[1]) * t),
    Math.round(base[2] + (toward[2] - base[2]) * t),
  ];
}

/**
 * The path, in a space where the head is centred at the origin and the tip
 * points at negative y.
 *
 * Two flanks and a half-circle. The control points pull the flanks slightly
 * inward, so the profile is concave near the tip the way a falling drop is,
 * rather than a straight-sided cone.
 */
function tracePath(ctx: CanvasRenderingContext2D, r: number, tip: number) {
  ctx.beginPath();
  ctx.moveTo(0, -tip);
  ctx.bezierCurveTo(r * 0.52, -tip * 0.55, r, -r * 0.55, r, 0);
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.bezierCurveTo(-r, -r * 0.55, -r * 0.52, -tip * 0.55, 0, -tip);
  ctx.closePath();
}

/**
 * How far the surface is from the centre in object-space direction `phi`.
 *
 * The head is a circle, so most directions are simply `r`; toward the tip the
 * boundary runs out to `tip`. The exponent keeps that stretch local to the
 * tail rather than swelling the whole object, so a sun's reflection is round
 * until the point swings past it and then draws out.
 */
function boundary(phi: number, r: number, tip: number): number {
  const towardTip = Math.max(0, -Math.sin(phi));
  return r + (tip - r) * towardTip ** 2.5;
}

export function drawDroplet(ctx: CanvasRenderingContext2D, options: DropletOptions) {
  const { x, y, length, rotation, lights, ground, alpha = 1 } = options;
  const r = length * HEAD;
  const tip = length - r;
  const span = (tip + r) * 2;

  ctx.save();
  try {
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);

    tracePath(ctx, r, tip);
    ctx.save();
    try {
      ctx.clip();

      // The sky, under a counter-rotation: the reflected world holds still and
      // the silhouette turns through it.
      ctx.save();
      ctx.rotate(-rotation);
      const body = ctx.createLinearGradient(0, -tip, 0, r);
      body.addColorStop(0, rgba(lift(ground, SKY, 0.1), 1));
      body.addColorStop(0.55, rgba(lift(ground, SKY, 0.035), 1));
      body.addColorStop(1, rgba(ground, 1));
      ctx.fillStyle = body;
      ctx.fillRect(-span, -span, span * 2, span * 2);

      // A broad sheen down one flank: the sky itself, not any one sun. Without
      // it the surface reads as matte and the object stops being metal.
      const sheen = ctx.createLinearGradient(-r, -tip * 0.6, r * 0.7, r * 0.8);
      sheen.addColorStop(0, rgba(SKY, 0.16));
      sheen.addColorStop(0.45, rgba(SKY, 0.04));
      sheen.addColorStop(1, rgba(SKY, 0));
      ctx.fillStyle = sheen;
      ctx.fillRect(-span, -span, span * 2, span * 2);
      ctx.restore();

      // The suns.
      ctx.globalCompositeOperation = "lighter";
      for (const light of lights) {
        // Local direction for a highlight that stays put in world space, and a
        // distance taken from the boundary in that direction — which is what
        // moves, because the boundary does.
        const phi = light.angle - rotation;
        const reach = boundary(phi, r, tip);
        const px = Math.cos(phi) * reach * 0.62;
        const py = Math.sin(phi) * reach * 0.62;
        const spot = r * 0.5 * (0.85 + 0.35 * (reach / r - 1));
        const rgb = toRgb(light.color);

        const glow = ctx.createRadialGradient(px, py, 0, px, py, spot);
        glow.addColorStop(0, rgba(rgb, 1));
        glow.addColorStop(0.28, rgba(rgb, 0.4));
        glow.addColorStop(1, rgba(rgb, 0));
        ctx.globalAlpha = alpha * light.strength;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, spot, 0, Math.PI * 2);
        ctx.fill();

        // The specular core. Small, white, and the reason it reads as polished
        // rather than merely lit.
        ctx.globalAlpha = alpha * light.strength * 0.9;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.6, r * 0.055), 0, Math.PI * 2);
        ctx.fill();
      }
    } finally {
      ctx.restore();
    }

    // The rim, drawn after the clip is released so it is not half cut away.
    // This is the edge of the object against the void, and on a real mirror it
    // is the brightest thing on it.
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "source-over";
    tracePath(ctx, r, tip);
    const rim = ctx.createLinearGradient(-r, -tip, r, r);
    rim.addColorStop(0, rgba(SKY, 0.75));
    rim.addColorStop(0.5, rgba(SKY, 0.28));
    rim.addColorStop(1, rgba(SKY, 0.6));
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(0.75, length * 0.006);
    ctx.stroke();
  } finally {
    ctx.restore();
  }
}
