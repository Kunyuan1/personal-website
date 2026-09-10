"use client";

import { useEffect, useRef } from "react";

import { drawDroplet, type DropletLight } from "@/lib/droplet";
import { SUN_COLORS } from "@/lib/trisolaris";

/**
 * One droplet, turning slowly, on a page with nothing else on it.
 *
 * Deliberately not wired to `EraProvider`. The 404 has no system on it — that
 * is the joke — so this owns a rotation and three invented light directions
 * and nothing else. It imports `SUN_COLORS` for the colours and no behaviour:
 * the three suns being off screen is the point, so nothing here integrates.
 *
 * The lights are fixed and the droplet turns. Drifting them as well would add a
 * second motion the eye cannot attribute to anything on a page whose premise is
 * that the system is somewhere else — and it would cost the reduced-motion path
 * a branch of its own, where this way stopping the rotation stops everything.
 */

/**
 * One turn every this many seconds. Slow enough that it reads as drifting
 * rather than spinning: a full rotation takes most of a minute, so at any
 * glance it looks still, and only looking twice tells you it moved.
 */
const TURN_SECONDS = 54;

/**
 * Where the three suns are, in radians, from a droplet that is no longer near
 * them. Spread unevenly on purpose — three lights at 120 degrees reads as a
 * decoration, and this should read as an accident of where it happens to be.
 */
const LIGHTS: DropletLight[] = [
  { angle: -0.9, color: SUN_COLORS[0], strength: 1 },
  { angle: 1.35, color: SUN_COLORS[1], strength: 0.72 },
  { angle: 2.7, color: SUN_COLORS[2], strength: 0.5 },
];

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

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (rotation: number) => {
      ctx.clearRect(0, 0, width, height);
      drawDroplet(ctx, {
        x: width / 2,
        y: height / 2,
        // Sized from its own box, which the page gives a fixed square, so
        // the object fills it without the copy having to move for it.
        length: Math.min(width, height) * 0.86,
        rotation,
        lights: LIGHTS,
      });
    };

    resize();

    // Reduced motion: drawn once, and no loop is left running behind it. The
    // droplet is still a droplet standing still — it is a mirror, not an
    // animation — so there is nothing to replace the rotation with.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      render(-0.35);
      const onResize = () => {
        resize();
        render(-0.35);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const started = performance.now();
    const tick = (now: number) => {
      render(((now - started) / 1000 / TURN_SECONDS) * Math.PI * 2 - 0.35);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
