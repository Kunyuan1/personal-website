"use client";

import { useEffect, useRef } from "react";

import { useEra } from "@/components/EraProvider";
import {
  HOME_COLOR,
  SUN_COLORS,
  WORLD_COLOR,
  type Orbit,
  type Planet,
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
    // The orbit the framing is easing away from, the one now in force, and
    // last frame's settle — a settle *beginning* is the moment to capture the
    // first of those.
    let fromOrbit: Orbit | null = null;
    let lastOrbit: Orbit | null = null;
    let lastSettle = 1;
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
      centerX = wide ? width * 0.73 : width * 0.5;
      centerY = wide ? height * 0.5 : height * 0.42;
    };

    /**
     * Framed from the outermost world, because the two periodic solutions hold
     * their worlds at very different radii. The small margin keeps Stable Era
     * orbits inside the frame; a Chaotic Era can still throw a world past the
     * edge, which is the point.
     */
    const scaleFor = (orbit: Orbit) => {
      const outermost = orbit.planetRadii[orbit.planetRadii.length - 1];
      const extent = outermost * 1.06;
      const wide = width >= 900;
      return wide
        ? Math.min((width * 0.4) / extent, (height * 0.46) / extent)
        : Math.min((width * 0.5) / extent, (height * 0.42) / extent);
    };

    /**
     * Eased across a collapse rather than read straight off the current orbit.
     * Every collapse switches orbit, so taking the scale from it alone resized
     * the frame by 43% between two frames — under the sun trails and the
     * ghosts that `resetInto` deliberately carries across that same frame so
     * nothing blinks. `settle` runs 0 -> 1 over exactly that window.
     *
     * Both scales are derived from the current size every frame, so a resize
     * part-way through a settle stays correct.
     */
    const rescale = (system: System) => {
      // Keyed on a settle starting rather than on the orbit changing: a
      // Chaotic Era the home world survives settles without switching orbit,
      // and easing that one from whatever orbit happened to precede it put
      // back the very jump this exists to remove.
      if (system.settle < 1 && lastSettle >= 1) fromOrbit = lastOrbit;
      lastSettle = system.settle;
      lastOrbit = system.orbit;

      const target = scaleFor(system.orbit);
      const t = system.settle;
      if (!fromOrbit || t >= 1) {
        scale = target;
        return;
      }
      const from = scaleFor(fromOrbit);
      scale = from + (target - from) * (t * t * (3 - 2 * t));
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

    /**
     * Worlds are small and cool so they never read as stars. Trisolaris is
     * drawn brighter, larger and with a ring around it; the others are grey
     * and plain, so the eye finds the home world without needing a label.
     */
    const drawWorld = (planet: Planet, isHome: boolean, alpha: number) => {
      const px = sx(planet.x);
      const py = sy(planet.y);
      const color = isHome ? HOME_COLOR : WORLD_COLOR;
      const core = isHome ? 3.2 : 1.9;
      const reach = isHome ? 13 : 7;

      ctx.globalAlpha = alpha;

      const halo = ctx.createRadialGradient(px, py, 0, px, py, reach);
      halo.addColorStop(0, `${color}${isHome ? "88" : "55"}`);
      halo.addColorStop(1, `${color}00`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, reach, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, core, 0, Math.PI * 2);
      ctx.fill();

      if (isHome) {
        // A thin ring, the one mark no other body on screen carries.
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, core + 3.6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    const render = (system: System) => {
      rescale(system);

      // Heat comes from the simulation, the same number the CSS palette uses,
      // so the canvas and the page can never drift out of step.
      const warmth = system.heat;
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

      // Worlds fade in over the settle, so a new civilisation arrives rather
      // than popping into place.
      const worldAlpha = system.settle;

      // The path each world is *meant* to be on, drawn from its `home` radius
      // rather than from where it actually is. During a Chaotic Era the gap
      // between the ring and the world is the whole point: it is how far chaos
      // has thrown it.
      //
      // Faded by heat rather than by era. Heat is the continuous value the
      // entire palette already runs on, so the rings recede as the page warms
      // instead of switching off — keying this on the discrete era would put
      // back exactly the snap that stripping `--heat` used to cause. They also
      // stop being true the moment the suns are perturbed, which is the other
      // reason not to leave them up.
      //
      // A world's orbit is circular only to within about 3%, measured over a
      // Stable Era, which at this scale is a pixel or two — close enough for a
      // guide, and the guide is gone by the time it would not be.
      const ringAlpha = 0.16 * (1 - warmth) * worldAlpha;
      if (ringAlpha > 0.002) {
        ctx.lineWidth = 0.8;
        for (const planet of system.planets) {
          if (!planet.alive) continue;
          // The home world's ring is brighter for the same reason its body is:
          // the eye should find Trisolaris without needing a label.
          ctx.strokeStyle = planet.isHome ? HOME_COLOR : WORLD_COLOR;
          ctx.globalAlpha = ringAlpha * (planet.isHome ? 1.5 : 1);
          ctx.beginPath();
          ctx.arc(centerX, centerY, planet.home * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Their paths are thinner and dimmer than the suns', so the eye reads
      // the bright periodic orbit first and the quiet ones second.
      system.planets.forEach((planet) => {
        if (!planet.alive) return;
        const isHome = planet.isHome;
        drawTrail(
          planet.trail,
          isHome ? HOME_COLOR : WORLD_COLOR,
          (isHome ? 0.5 : 0.28) * worldAlpha,
          isHome ? 1.1 : 0.7,
        );
      });

      for (let i = 0; i < system.sunTrails.length; i++) {
        drawTrail(system.sunTrails[i], SUN_COLORS[i], 0.9, 2.2);
      }

      // Worlds that have been destroyed fade out where they died rather than
      // disappearing between two frames.
      system.ghosts.forEach((ghost) => {
        const alpha = Math.max(0, ghost.fade);
        // Drawn exactly as it was in life, home world included. A ghost exists
        // to keep a death from being a cut, and demoting Trisolaris to a
        // generic grey world at the instant it dies is the hardest cut on
        // screen — on the one body the design says the eye is tracking.
        drawTrail(
          ghost.trail,
          ghost.isHome ? HOME_COLOR : WORLD_COLOR,
          (ghost.isHome ? 0.5 : 0.28) * alpha,
          ghost.isHome ? 1.1 : 0.7,
        );
        drawWorld(ghost, ghost.isHome, alpha);
      });

      system.planets.forEach((planet) => {
        if (planet.alive) drawWorld(planet, planet.isHome, worldAlpha);
      });

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
