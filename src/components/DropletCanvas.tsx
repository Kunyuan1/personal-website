"use client";

import { useEffect, useRef } from "react";

import { groundFor, heatFromDocument } from "@/lib/canvas-ground";
import { drawDroplet, type DropletLight } from "@/lib/droplet";
import { SUN_COLORS } from "@/lib/trisolaris";

/**
 * One droplet, turning slowly, on a page with nothing else on it.
 *
 * Deliberately not wired to `EraProvider`. The 404 has no system on it — that
 * is the joke — so this owns a rotation and three light directions and nothing
 * else. It imports `SUN_COLORS` for the colours and no behaviour: the three
 * suns being off screen is the point, so nothing here integrates.
 */

/**
 * One turn every this many seconds. Slow enough that it reads as drifting
 * rather than spinning: a full rotation takes most of a minute, so at any
 * glance it looks still, and only looking twice tells you it moved.
 */
const TURN_SECONDS = 54;

/**
 * How fast the three suns wander, in radians per second.
 *
 * The lights used to be fixed, on the argument that the droplet's own rotation
 * already swept the highlights across it. That argument was wrong twice over.
 * The first version's highlight transform cancelled the rotation exactly, so
 * nothing swept at all; and once that was fixed, a mirror's specular highlight
 * *stays* in the direction of its light however the mirror turns — the rotation
 * moves how far out the reflection sits, not which way. On a head that is
 * mostly circular, that is a small effect for most of a turn.
 *
 * So the suns drift. Unequal rates, none of them a divisor of another, so the
 * three never fall into a pattern a viewer could anticipate — which is the one
 * thing this system is famously not.
 */
const DRIFT = [0.021, -0.013, 0.034];

/**
 * Where the three suns are to begin with. Spread unevenly on purpose: three
 * lights at 120 degrees reads as a decoration, and this should read as an
 * accident of where the droplet happens to be.
 */
const LIGHTS: DropletLight[] = [
  { angle: -0.9, color: SUN_COLORS[0], strength: 1 },
  { angle: 1.35, color: SUN_COLORS[1], strength: 0.72 },
  { angle: 2.7, color: SUN_COLORS[2], strength: 0.5 },
];

/**
 * How often `--heat` is re-read, in milliseconds.
 *
 * Not every frame: reading it is a `getComputedStyle` call, and heat is
 * quantised to 1% by `EraProvider` and falls over seconds. Four times a second
 * is finer than the value can actually change and costs a sixtieth of what
 * per-frame would.
 */
const HEAT_SAMPLE_MS = 250;

export default function DropletCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let heat = heatFromDocument();
    let heatSampledAt = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (seconds: number) => {
      ctx.clearRect(0, 0, width, height);
      drawDroplet(ctx, {
        x: width / 2,
        y: height / 2,
        // 0.82 rather than 0.86 of the box: at 0.86 the tip reaches within a
        // quarter of a pixel of the edge, so the rim — the brightest thing on
        // the object — was shaved every time the point passed an edge midpoint,
        // four times a turn, and read as the tip intermittently blunting.
        length: Math.min(width, height) * 0.82,
        rotation: (seconds / TURN_SECONDS) * Math.PI * 2 - 0.35,
        lights: LIGHTS.map((light, i) => ({
          ...light,
          angle: light.angle + DRIFT[i] * seconds,
        })),
        ground: groundFor(heat),
      });
    };

    resize();

    // Reduced motion: drawn once, and no loop is left running behind it. The
    // droplet is still a droplet standing still — it is a mirror, not an
    // animation — so there is nothing to replace the rotation with.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const still = () => {
        resize();
        heat = heatFromDocument();
        render(0);
      };
      still();
      window.addEventListener("resize", still);
      return () => window.removeEventListener("resize", still);
    }

    const started = performance.now();
    const tick = (now: number) => {
      if (now - heatSampledAt > HEAT_SAMPLE_MS) {
        heatSampledAt = now;
        heat = heatFromDocument();
      }
      render((now - started) / 1000);
      frame = requestAnimationFrame(tick);
    };

    // Nothing turns while nobody is looking. `EraProvider` stops its own loop on
    // the same event, so a hidden 404 wakes the main thread for neither of them.
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
