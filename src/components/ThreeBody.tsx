"use client";

import { useEffect, useRef } from "react";

export type Era = "stable" | "chaotic";

export type SimState = {
  era: Era;
  civilization: number;
};

type Props = {
  className?: string;
  onStateChange?: (state: SimState) => void;
};

/* ---------------------------------------------------------------
   Physics.

   Three equal masses under Newtonian gravity, G = m = 1. There is no
   closed-form solution — which is the point of the book, and the reason
   this can't be faked with a CSS animation.

   The Stable Era runs the Chenciner-Montgomery figure-eight choreography:
   a real periodic solution in which all three bodies chase each other
   around one closed curve. Perturb it and it decays into chaos, ejects a
   body, and that civilisation ends.
   --------------------------------------------------------------- */

const G = 1;
const SOFTENING = 0.008; // avoids a singularity on close approach
const DT = 0.0022;
const SUBSTEPS = 8;

/** Period of the figure-eight solution, in simulation time. */
const PERIOD = 6.3259;
/** How long the Stable Era lasts before the perturbation arrives. */
const STABLE_DURATION = PERIOD * 2.5;
/** Distance from the barycentre at which a body counts as ejected. */
const EJECTION_RADIUS = 7;

const SUN_COLORS = ["#e6a94c", "#7fb2ff", "#d4544a"] as const;

/** Simulation frames per second of real time, independent of display rate. */
const SIM_HZ = 60;
const SIM_FRAME = 1 / SIM_HZ;
/** Most simulation time a single animation frame may catch up on, in seconds. */
const MAX_CATCHUP = 0.5;

/** Frames of history kept per body — about one full figure-eight period. */
const TRAIL_LENGTH = 380;
/** Trails are stroked in bands rather than per-segment, to keep it cheap. */
const TRAIL_BANDS = 14;

type Body = { x: number; y: number; vx: number; vy: number; ax: number; ay: number };
type Point = { x: number; y: number };

function figureEight(): Body[] {
  const vx = 0.466203685;
  const vy = 0.43236573;
  return [
    { x: 0.97000436, y: -0.24308753, vx, vy, ax: 0, ay: 0 },
    { x: -0.97000436, y: 0.24308753, vx, vy, ax: 0, ay: 0 },
    { x: 0, y: 0, vx: -2 * vx, vy: -2 * vy, ax: 0, ay: 0 },
  ];
}

function computeAccelerations(bodies: Body[]) {
  for (const b of bodies) {
    b.ax = 0;
    b.ay = 0;
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy + SOFTENING;
      const inv = G / (distSq * Math.sqrt(distSq));
      a.ax += dx * inv;
      a.ay += dy * inv;
      b.ax -= dx * inv;
      b.ay -= dy * inv;
    }
  }
}

/** One velocity-Verlet step. Symplectic, so energy stays honest over time. */
function step(bodies: Body[], dt: number) {
  const half = 0.5 * dt;
  for (const b of bodies) {
    b.vx += b.ax * half;
    b.vy += b.ay * half;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  computeAccelerations(bodies);
  for (const b of bodies) {
    b.vx += b.ax * half;
    b.vy += b.ay * half;
  }
}

export default function ThreeBody({ className = "", onStateChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onStateChangeRef = useRef(onStateChange);

  // Kept in a ref so the simulation effect never restarts when the parent
  // re-renders with a new callback identity.
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let bodies = figureEight();
    computeAccelerations(bodies);
    let trails: Point[][] = [[], [], []];

    let era: Era = "stable";
    let civilization = 1;
    let elapsed = 0;
    let width = 0;
    let height = 0;
    let scale = 1;
    let centerX = 0;
    let centerY = 0;
    let running = true;
    let frame = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const emit = () => onStateChangeRef.current?.({ era, civilization });
    emit();

    const recordTrail = () => {
      for (let i = 0; i < bodies.length; i++) {
        const trail = trails[i];
        trail.push({ x: bodies[i].x, y: bodies[i].y });
        if (trail.length > TRAIL_LENGTH) trail.shift();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // On wide screens the text occupies the left, so the system sits to its
      // right. On narrow screens it recentres and sits behind the type.
      const wide = width >= 900;
      centerX = wide ? width * 0.68 : width * 0.5;
      centerY = wide ? height * 0.5 : height * 0.42;
      scale = wide
        ? Math.min((width * 0.5) / 2.6, height / 2.3)
        : Math.min(width / 2.9, height / 3.4);
    };

    const reset = (nextEra: Era) => {
      bodies = figureEight();
      computeAccelerations(bodies);
      trails = [[], [], []];
      elapsed = 0;
      era = nextEra;
      emit();
    };

    /** Nudge the system off the periodic solution — the Chaotic Era begins. */
    const destabilise = () => {
      for (const b of bodies) {
        b.vx += (Math.random() - 0.5) * 0.06;
        b.vy += (Math.random() - 0.5) * 0.06;
      }
      era = "chaotic";
      emit();
    };

    const sx = (x: number) => centerX + x * scale;
    const sy = (y: number) => centerY + y * scale;

    /**
     * Trails are stored in world coordinates, so a resize reprojects the whole
     * history instead of leaving a kink where the scale changed.
     */
    const drawTrail = (trail: Point[], color: string) => {
      const n = trail.length;
      if (n < 2) return;

      const per = Math.ceil(n / TRAIL_BANDS);
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let band = 0; band < TRAIL_BANDS; band++) {
        const start = band * per;
        const end = Math.min(n, start + per + 1);
        if (end - start < 2) continue;

        // 0 at the oldest end of the trail, 1 at the body itself.
        const t = (band + 1) / TRAIL_BANDS;
        ctx.globalAlpha = 0.14 + t * 0.72;
        ctx.lineWidth = 1 + t * 2.2;

        ctx.beginPath();
        ctx.moveTo(sx(trail[start].x), sy(trail[start].y));
        for (let k = start + 1; k < end; k++) {
          ctx.lineTo(sx(trail[k].x), sy(trail[k].y));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const drawHead = (b: Body, color: string) => {
      const x = sx(b.x);
      const y = sy(b.y);

      const glow = ctx.createRadialGradient(x, y, 0, x, y, 18);
      glow.addColorStop(0, `${color}aa`);
      glow.addColorStop(0.35, `${color}33`);
      glow.addColorStop(1, `${color}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, width, height);

      // Additive, so the trails bloom where the three orbits cross.
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < trails.length; i++) drawTrail(trails[i], SUN_COLORS[i]);
      for (let i = 0; i < bodies.length; i++) drawHead(bodies[i], SUN_COLORS[i]);
      ctx.globalCompositeOperation = "source-over";
    };

    const tick = (now: number) => {
      if (!running) return;

      // Fixed-timestep accumulator. The simulation advances by wall-clock time
      // rather than once per frame, so the orbit runs at the same speed — and
      // the trails cover the same span — at 30fps, 60fps or 144fps. The clamp
      // stops a long stall (background tab, slow paint) from trying to catch
      // up all at once.
      const delta = Math.min((now - lastTime) / 1000, MAX_CATCHUP);
      lastTime = now;
      accumulator += delta;

      while (accumulator >= SIM_FRAME) {
        for (let i = 0; i < SUBSTEPS; i++) step(bodies, DT);
        elapsed += DT * SUBSTEPS;
        recordTrail();
        accumulator -= SIM_FRAME;
      }

      if (era === "stable" && elapsed > STABLE_DURATION) {
        destabilise();
      } else if (era === "chaotic") {
        // A body escaping means the system has come apart: this civilisation
        // is destroyed, and the next begins from a stable configuration.
        const escaped = bodies.some((b) => Math.hypot(b.x, b.y) > EJECTION_RADIUS);
        if (escaped) {
          civilization += 1;
          reset("stable");
        }
      }

      render();
      frame = requestAnimationFrame(tick);
    };

    resize();

    if (reduced) {
      // Trace one complete figure-eight and stop. No animation, but the shape
      // of the stable solution is still there to look at.
      for (let f = 0; f < TRAIL_LENGTH; f++) {
        for (let i = 0; i < SUBSTEPS; i++) step(bodies, DT);
        recordTrail();
      }
      render();
      return;
    }

    frame = requestAnimationFrame(tick);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    // Don't burn cycles on a tab nobody is looking at.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        lastTime = performance.now();
        accumulator = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={className} aria-hidden="true" role="presentation" />
  );
}
