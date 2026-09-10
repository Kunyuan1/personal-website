"use client";

import { useEffect, useRef } from "react";

import { groundFor, heatFromDocument } from "@/lib/canvas-ground";
import { drawSophon } from "@/lib/sophon";

/**
 * The sophon on the 404: folded, unfolding, held open, folded again.
 *
 * Deliberately not wired to `EraProvider`. This page has no system on it — that
 * is the joke — so the component owns a clock and nothing else, and the only
 * thing it reads from the rest of the site is `--heat`, so an opaque canvas is
 * not a cold rectangle on a page that has gone red.
 */

/**
 * The cycle, in seconds, and what happens when.
 *
 * Most of it is a point. The sphere is open for about a fifth of the cycle, and
 * for the rest the page carries one speck of light and nothing else — which is
 * the intended experience of the page: it looks completely static, and only
 * someone who stays long enough to be surprised ever sees the sky open.
 *
 * A visitor who came here from a dead link and leaves in five seconds will
 * almost certainly see nothing move, and that is correct. The alternative — a
 * loop short enough to guarantee they catch it — turns a rare event into an
 * animation playing at them, which is the failure mode of every decorative
 * background ever shipped.
 */
const CYCLE_SECONDS = 46;
const OPENS_AT = 17;
const OPEN_OVER = 6.5;
const HOLDS_FOR = 12;
const CLOSES_OVER = 5;

/** One turn of the etched surface, in seconds, while it is open. */
const TURN_SECONDS = 62;

/** How often `--heat` is re-read. See DropletCanvas's note; same reasoning. */
const HEAT_SAMPLE_MS = 250;

/** 0 folded, 1 fully open, for a time within the cycle. */
function unfoldAt(seconds: number): number {
  const t = ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  if (t < OPENS_AT) return 0;
  const since = t - OPENS_AT;
  if (since < OPEN_OVER) return since / OPEN_OVER;
  if (since < OPEN_OVER + HOLDS_FOR) return 1;
  const closing = since - OPEN_OVER - HOLDS_FOR;
  if (closing < CLOSES_OVER) return 1 - closing / CLOSES_OVER;
  return 0;
}

export default function SophonCanvas({ className = "" }: { className?: string }) {
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
      drawSophon(ctx, {
        x: width / 2,
        y: height / 2,
        // Short of half the box, so the silhouette — the brightest line on it —
        // is never shaved by the canvas edge.
        radius: Math.min(width, height) * 0.44,
        unfold: unfoldAt(seconds),
        rotation: (seconds / TURN_SECONDS) * Math.PI * 2,
        ground: groundFor(heat),
      });
    };

    resize();

    // Reduced motion: one frame, held open. The unfolding is the whole idea, so
    // the still version is the sophon at full extent rather than the proton —
    // a page showing a single dot would be indistinguishable from a bug.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const still = () => {
        resize();
        heat = heatFromDocument();
        render(OPENS_AT + OPEN_OVER + HOLDS_FOR / 2);
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

    // Nothing unfolds while nobody is looking. `EraProvider` stops its own loop
    // on the same event, so a hidden 404 wakes the main thread for neither.
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
