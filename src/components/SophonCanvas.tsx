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
 * The first version made the visitor wait 17 seconds for the sphere to open, on
 * the argument that a rare event is worth more than a guaranteed one. That
 * argument belongs to the hero, where the simulation runs continuously and
 * someone is there long enough for rarity to reward them. **It is wrong here.**
 * A visitor on a 404 is leaving; there is no long tail of attention to pay off,
 * so rare does not mean precious, it means never seen — and an effect nobody
 * sees is only cost.
 *
 * The wait was not the whole of it either. Opening *at* three seconds is not a
 * sphere at three seconds: the unfolding took 6.5 more, so the thing was not
 * fully open until nine and a half, by which time most people have gone.
 * Whatever the wait, the gesture has to finish inside the visit.
 *
 * So the first unfolding is not on a timer at all — it is the page arriving.
 * `FIRST_UNFOLD_AT` phase-shifts the clock so the sky opens about a second
 * after load, and everything after it is the loop, which stays unhurried
 * because a repeat is only for someone who stayed.
 *
 * The opening is not shortened below about three seconds on purpose. Faster
 * than that it stops reading as something *opening* and starts reading as a
 * loading spinner, which is the one thing this page must not look like.
 */
const CYCLE_SECONDS = 34;
const OPENS_AT = 18;
const OPEN_OVER = 3.5;
const HOLDS_FOR = 9;
const CLOSES_OVER = 3.5;
/** When the sphere has finished folding away and nothing changes again. */
const FOLDED_AT = OPENS_AT + OPEN_OVER + HOLDS_FOR + CLOSES_OVER;
/** The middle of the held-open stretch: the one frame a still render should be. */
const HELD_OPEN_AT = OPENS_AT + OPEN_OVER + HOLDS_FOR / 2;
/**
 * How long after the page arrives the sky opens.
 *
 * Long enough for the page to paint and the eye to land on the object, short
 * enough that the whole gesture — open, hold, fold — is over inside about
 * sixteen seconds, and the striking half of it inside five.
 */
const FIRST_UNFOLD_AT = 1;

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
    // The clock starts part-way through the cycle, so the first thing a visitor
    // sees is the sky opening rather than a wait for it. `unfoldAt` stays a pure
    // function of elapsed time; only where that time begins has moved.
    const started = performance.now() - (OPENS_AT - FIRST_UNFOLD_AT) * 1000;

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
