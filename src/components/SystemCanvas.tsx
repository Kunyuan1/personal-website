"use client";

import { useEffect, useRef } from "react";

import { useEra } from "@/components/EraProvider";
import {
  PLANET_COLOR,
  SUN_COLORS,
  type Point,
  type System,
} from "@/lib/trisolaris";

/** Trails are stroked in bands rather than per-segment, to keep it cheap. */
const TRAIL_BANDS = 14;

/**
 * The canvas is opaque, so it has to repaint the page's own background or the
 * hero would stay a cold rectangle while the rest of the site goes red. These
 * must match --void in globals.css for the two eras.
 */
const CANVAS_GROUND = {
  stable: [5, 6, 10],
  chaotic: [27, 10, 10],
} as const;

/** Fraction of the remaining distance covered per frame, ~1.6s to converge. */
const WARMTH_EASING = 0.026;

/**
 * Draws the Trisolaran system. Owns no simulation state — EraProvider runs the
 * physics and calls back once per frame, so the canvas never triggers a React
 * render and the same system keeps running across route changes.
 */
export default function SystemCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { registerRenderer } = useEra();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let scale = 1;
    let centerX = 0;
    let centerY = 0;
    let warmth = 0;

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
      centerX = wide ? width * 0.73 : width * 0.5;
      centerY = wide ? height * 0.5 : height * 0.42;
    };

    /**
     * Framed from the planet's own orbit, because the two periodic solutions
     * put it at different radii. The 1.25 margin keeps a Stable Era orbit well
     * inside the frame; a Chaotic Era can still throw the planet past the edge,
     * which is the point.
     */
    const rescale = (system: System) => {
      const extent = system.orbit.planetOrbit * 1.25;
      const wide = width >= 900;
      scale = wide
        ? Math.min((width * 0.4) / extent, (height * 0.46) / extent)
        : Math.min((width * 0.5) / extent, (height * 0.42) / extent);
    };

    const sx = (x: number) => centerX + x * scale;
    const sy = (y: number) => centerY + y * scale;

    const drawTrail = (
      trail: Point[],
      color: string,
      maxAlpha: number,
      maxWidth: number,
    ) => {
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
        ctx.globalAlpha = maxAlpha * (0.16 + t * 0.84);
        ctx.lineWidth = 0.6 + t * maxWidth;

        ctx.beginPath();
        ctx.moveTo(sx(trail[start].x), sy(trail[start].y));
        for (let k = start + 1; k < end; k++) {
          ctx.lineTo(sx(trail[k].x), sy(trail[k].y));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    /** Suns are large, bright and haloed — unmistakably stars. */
    const drawSun = (x: number, y: number, color: string) => {
      const px = sx(x);
      const py = sy(y);

      const corona = ctx.createRadialGradient(px, py, 0, px, py, 34);
      corona.addColorStop(0, `${color}cc`);
      corona.addColorStop(0.22, `${color}55`);
      corona.addColorStop(0.55, `${color}18`);
      corona.addColorStop(1, `${color}00`);
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(px, py, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 4.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 1.9, 0, Math.PI * 2);
      ctx.fill();
    };

    /** The planet is small, cool and dim — clearly not a star. */
    const drawPlanet = (x: number, y: number) => {
      const px = sx(x);
      const py = sy(y);

      const halo = ctx.createRadialGradient(px, py, 0, px, py, 9);
      halo.addColorStop(0, `${PLANET_COLOR}66`);
      halo.addColorStop(1, `${PLANET_COLOR}00`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = PLANET_COLOR;
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (system: System) => {
      rescale(system);

      // Ease toward the era's ground colour rather than cutting to it, so the
      // canvas warms in step with the CSS transition on the rest of the page.
      warmth += ((system.era === "chaotic" ? 1 : 0) - warmth) * WARMTH_EASING;
      const cold = CANVAS_GROUND.stable;
      const hot = CANVAS_GROUND.chaotic;
      const r = Math.round(cold[0] + (hot[0] - cold[0]) * warmth);
      const g = Math.round(cold[1] + (hot[1] - cold[1]) * warmth);
      const b = Math.round(cold[2] + (hot[2] - cold[2]) * warmth);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, width, height);

      // The page-wide .era-wash sits behind <main>, so this opaque canvas
      // blocks it and would leave a seam where the hero meets the rest of the
      // page. Draw the same heat glow here so the two line up.
      if (warmth > 0.01) {
        const reach = Math.max(width, height) * 1.15;

        const top = ctx.createRadialGradient(width * 0.5, 0, 0, width * 0.5, 0, reach);
        top.addColorStop(0, `rgba(226, 96, 78, ${0.3 * warmth})`);
        top.addColorStop(0.72, "rgba(226, 96, 78, 0)");
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, width, height);

        const bottom = ctx.createRadialGradient(
          width * 0.5,
          height,
          0,
          width * 0.5,
          height,
          reach,
        );
        bottom.addColorStop(0, `rgba(178, 52, 44, ${0.22 * warmth})`);
        bottom.addColorStop(0.74, "rgba(178, 52, 44, 0)");
        ctx.fillStyle = bottom;
        ctx.fillRect(0, 0, width, height);
      }

      // Additive, so trails bloom where the orbits cross.
      ctx.globalCompositeOperation = "lighter";

      // The planet's path is drawn thinner and dimmer than the suns', so the
      // eye reads the bright figure-eight first and the quiet orbit second.
      drawTrail(system.planetTrail, PLANET_COLOR, 0.5, 1.1);
      for (let i = 0; i < system.sunTrails.length; i++) {
        drawTrail(system.sunTrails[i], SUN_COLORS[i], 0.9, 2.2);
      }

      drawPlanet(system.planet.x, system.planet.y);
      for (let i = 0; i < system.suns.length; i++) {
        drawSun(system.suns[i].x, system.suns[i].y, SUN_COLORS[i]);
      }

      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    registerRenderer(render);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      registerRenderer(null);
      window.removeEventListener("resize", onResize);
    };
  }, [registerRenderer]);

  return (
    <canvas ref={canvasRef} className={className} aria-hidden="true" role="presentation" />
  );
}
