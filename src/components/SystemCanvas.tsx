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
        ? Math.min((width * 0.46) / extent, (height * 0.5) / extent)
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

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, width, height);

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
