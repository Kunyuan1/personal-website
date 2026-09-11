"use client";

import { useEffect, useRef } from "react";

import { drawSophon } from "@/lib/sophon";

/**
 * The sophon on the 404: folded, unfolding, held open, folded again.
 *
 * Deliberately not wired to `EraProvider`. This page has no system on it — that
 * is the joke — so the component owns a clock and nothing else.
 *
 * It reads nothing from the rest of the site either, not even `--heat`. The
 * drawing is additive, so the page's own colour comes through the sphere
 * wherever the page happens to be: cold, warm, or mid-fade. That is one fewer
 * `getComputedStyle` per frame and one fewer thing to be wrong about.
 */

/**
 * The cycle, in seconds, and what happens when.
 *
 * The sphere is fully open for `12/46` — **26%** of the cycle — and on screen at
 * all, counting the opening and closing, for `23.5/46` — **51%**. So for a
 * little under half of every cycle the page carries one speck of light and
 * nothing else.
 *
 * A visitor who came here from a dead link and leaves in five seconds may well
 * see nothing move, and that is correct. The alternative — a loop short enough
 * to guarantee they catch it — turns a rare event into an animation playing at
 * them, which is the failure mode of every decorative background ever shipped.
 */
const CYCLE_SECONDS = 46;
const OPENS_AT = 17;
const OPEN_OVER = 6.5;
const HOLDS_FOR = 12;
const CLOSES_OVER = 5;
/** When the sphere has finished folding away and nothing changes again. */
const FOLDED_AT = OPENS_AT + OPEN_OVER + HOLDS_FOR + CLOSES_OVER;
/** The middle of the held-open stretch: the one frame a still render should be. */
const HELD_OPEN_AT = OPENS_AT + OPEN_OVER + HOLDS_FOR / 2;

/**
 * One turn of the **wireframe**, in seconds.
 *
 * Not the etching, which lags it by `ETCH_PARALLAX` and so comes round in about
 * 103s. Naming the surface here matters: tuning this to change how fast the
 * circuitry drifts gets 0.6x the change asked for, and moves the mesh as well.
 */
const TURN_SECONDS = 62;

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

/** Seconds from `t` until the sphere next starts to open. */
function sleepUntilOpening(seconds: number): number {
  const t = ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  return t < OPENS_AT ? OPENS_AT - t : CYCLE_SECONDS - t + OPENS_AT;
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
    let sleep: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();

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
      if (width < 2 || height < 2) return;
      ctx.clearRect(0, 0, width, height);
      drawSophon(ctx, {
        x: width / 2,
        y: height / 2,
        // Short of half the box, so the silhouette — the brightest line on it —
        // is never shaved by the canvas edge.
        radius: Math.min(width, height) * 0.44,
        unfold: unfoldAt(seconds),
        rotation: (seconds / TURN_SECONDS) * Math.PI * 2,
      });
    };

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion: one frame, held open. The unfolding is the whole idea, so
    // the still version is the sophon at full extent rather than the proton —
    // a page showing a single dot would be indistinguishable from a bug.
    const paint = () => render(reduced ? HELD_OPEN_AT : (performance.now() - started) / 1000);

    /**
     * Re-measure whenever the box changes, not only when the window does.
     *
     * The box is sized in `svh`, and it was measured once in an effect that can
     * run before layout has settled on that unit: caught it at 0x0, painted into
     * a 1x1 backing store, and — listening only for `resize` — never recovered,
     * so the page carried an invisible canvas until something else moved. A
     * `ResizeObserver` covers the window resize case too, and this one.
     */
    const observer = new ResizeObserver(() => {
      resize();
      paint();
    });
    observer.observe(canvas);

    resize();
    paint();

    if (reduced) return () => observer.disconnect();

    /**
     * Animation frames only while something is moving.
     *
     * `unfoldAt` is a pure function of time, so the quiet stretch is known in
     * closed form rather than discovered a frame at a time: for the 22.5s the
     * sphere is folded away, every frame would be bit-identical — a `clearRect`
     * and two radial gradients to redraw the same dot, sixty times a second, on
     * the page whose ticket asked for it to be cheap. So the folded stretch is
     * painted once and then slept through, and frames resume just before it
     * opens.
     */
    const tick = (now: number) => {
      const seconds = (now - started) / 1000;
      render(seconds);

      const phase = ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
      if (phase >= FOLDED_AT || phase < OPENS_AT) {
        sleep = setTimeout(
          () => {
            frame = requestAnimationFrame(tick);
          },
          Math.max(16, sleepUntilOpening(seconds) * 1000 - 32),
        );
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(sleep);
    };

    // Nothing unfolds while nobody is looking. `EraProvider` stops its own loop
    // on the same event, so a hidden 404 wakes the main thread for neither.
    const onVisibility = () => {
      stop();
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
