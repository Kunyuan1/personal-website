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
 * 404, which draws one large and still-ish in the middle of an empty page, and
 * the droplet cursor (#10), which draws one small under the pointer on a page
 * that is already busy. Same object, so the same code decides what it looks
 * like. `era-label.ts` is here for the same reason.
 *
 * It knows nothing about the simulation. It takes light *directions*, not sun
 * positions, so a caller with three real suns can hand it their angles and a
 * caller with none — the 404, where the system is deliberately not on screen —
 * can invent three and get the same object back.
 */

/** Where a light is, and what colour it burns. Angles are world-space radians. */
export type DropletLight = {
  angle: number;
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
  /** 0..1, for fading the whole object in. Defaults to 1. */
  alpha?: number;
};

/**
 * The head is this fraction of the total length, which leaves the rest as tail.
 *
 * At 0.42 the silhouette reads as a droplet rather than a teardrop emoji or a
 * bullet: enough head to hold the reflections, enough tail to have a direction.
 */
const HEAD = 0.42;

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

export function drawDroplet(ctx: CanvasRenderingContext2D, options: DropletOptions) {
  const { x, y, length, rotation, lights, alpha = 1 } = options;
  const r = length * HEAD;
  const tip = length - r;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);

  tracePath(ctx, r, tip);
  ctx.save();
  ctx.clip();

  // The body is nearly the colour of the page, because a mirror in an empty
  // sky is mostly reflecting the empty sky. What separates it from the
  // background is the rim and the three highlights, and nothing else.
  const body = ctx.createLinearGradient(0, -tip, 0, r);
  body.addColorStop(0, "#161c28");
  body.addColorStop(0.55, "#0b0f18");
  body.addColorStop(1, "#05070c");
  ctx.fillStyle = body;
  ctx.fillRect(-r * 1.2, -tip * 1.2, r * 2.4, (tip + r) * 1.4);

  // A broad sheen down one flank: the sky itself, not any one sun. Without it
  // the surface reads as matte and the object stops being metal.
  const sheen = ctx.createLinearGradient(-r, -tip * 0.6, r * 0.7, r * 0.8);
  sheen.addColorStop(0, "rgba(188, 211, 232, 0.16)");
  sheen.addColorStop(0.45, "rgba(188, 211, 232, 0.04)");
  sheen.addColorStop(1, "rgba(188, 211, 232, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(-r * 1.2, -tip * 1.2, r * 2.4, (tip + r) * 1.4);

  // The suns.
  //
  // Their angles are world-space, so the *local* angle is the light's minus the
  // droplet's rotation — which is what makes the reflections travel across the
  // surface as it turns. A sphere would not do this, since rotating a sphere
  // changes none of its normals; a droplet is not a sphere, and the moving
  // highlights are most of what says so.
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    const local = light.angle - rotation;
    const px = Math.cos(local) * r * 0.58;
    const py = Math.sin(local) * r * 0.58;
    const spot = r * 0.5;

    const glow = ctx.createRadialGradient(px, py, 0, px, py, spot);
    glow.addColorStop(0, light.color);
    glow.addColorStop(0.28, `${light.color}66`);
    glow.addColorStop(1, `${light.color}00`);
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

  ctx.restore();

  // The rim, drawn after the clip is released so it is not half cut away. This
  // is the edge of the object against the void, and on a real mirror it is the
  // brightest thing on it.
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "source-over";
  tracePath(ctx, r, tip);
  const rim = ctx.createLinearGradient(-r, -tip, r, r);
  rim.addColorStop(0, "rgba(214, 230, 246, 0.75)");
  rim.addColorStop(0.5, "rgba(214, 230, 246, 0.28)");
  rim.addColorStop(1, "rgba(214, 230, 246, 0.6)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(0.75, length * 0.006);
  ctx.stroke();

  ctx.restore();
}
