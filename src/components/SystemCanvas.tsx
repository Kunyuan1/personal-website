"use client";

import { useEffect, useRef } from "react";

import { useEra } from "@/components/EraProvider";
import { groundFor } from "@/lib/canvas-ground";
import {
  frameRadiusFor,
  HOME_COLOR,
  SETTLE_TIME,
  SUN_COLORS,
  WORLD_COLOR,
  WORLD_FADE_TIME,
  type Orbit,
  type Planet,
  type Point,
  type System,
} from "@/lib/trisolaris";

/**
 * The flattest the scene is ever drawn.
 *
 * Not zero: `scale(1, 0)` is singular and draws nothing at all, and the
 * whole point is that the flat thing is *visible* — a luminous line with
 * every trail and glow in the system stacked onto it.
 */
const FLAT = 0.015;

/**
 * How far into the rise the horizon has faded out.
 *
 * The flattened system alone is not luminous. Compressing the scene does not
 * concentrate its light — a sun's core is a 4.4px disc that becomes sub-pixel
 * and antialiases *down*, so measured, the flat state peaked at luminance 100
 * against the standing system's 255. A dimmer scene, not a brighter line.
 *
 * So the line is drawn, rather than hoped for. It is not a trick standing in
 * for the squashed system: it is the horizon that system has been pressed
 * onto, and it fades as the system leaves it. With it, the flat state peaks at
 * 184 against a ground of 6, and brightens monotonically across the ramp —
 * 184, 241, 255 — so the line opens into the scene rather than dipping through
 * a dim middle.
 *
 * The ticket forbids a white-out, and compressing the scene is a real way to
 * cause one: every trail and glow is stacked additively onto a handful of rows.
 * Measured as the share of pixels above luminance 245, the worst frame of the
 * ramp is 0.005%, under the 0.013% the standing system sits at anyway. The
 * danger is concentrated at rise 0, where the scene is compressed 5x harder
 * than at 0.1: a white horizon there measures 0.464%, ninety times this one.
 * Peak luminance cannot see any of that — it reads 255 either way.
 *
 * Every number above depends on the `globalCompositeOperation` set at the draw
 * site below, and an earlier version of it measured 174/0.005% while silently
 * compositing `source-over` — occluding 78% of the system it claimed to be the
 * resting place of. Re-measure this block if that line moves.
 */
const HORIZON_UNTIL = 0.45;

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
      const extent = frameRadiusFor(orbit);
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

    /**
     * `visible` is the share of the stored trail to draw, and it exists for
     * rehydration: the simulation is frozen while the tab is hidden, so on the
     * way back the trail is still stored at full length and has to be clipped
     * rather than regrown. The newest points are the ones kept, so the trail
     * unfurls backwards from the body it belongs to instead of the body
     * arriving detached from its own path.
     *
     * Banded across the drawn span rather than the stored one — the ramp puts
     * its brightest band at the body, and banding the stored length would
     * leave that band off the end of what is actually on screen.
     */
    const drawTrail = (
      trail: Point[],
      color: string,
      maxAlpha: number,
      maxWidth: number,
      visible: number,
    ) => {
      // An index rather than a slice: this runs for every body, every frame.
      const from = trail.length - Math.ceil(trail.length * visible);
      const n = trail.length - from;
      if (n < 2) return;

      const per = Math.ceil(n / TRAIL_BANDS);
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let band = 0; band < TRAIL_BANDS; band++) {
        const start = from + band * per;
        const end = Math.min(trail.length, start + per + 1);
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

    const render = (system: System, hydration: number, rise: number) => {
      rescale(system);

      // Heat comes from the simulation, the same number the CSS palette uses,
      // so the canvas and the page can never drift out of step — including
      // through a rehydration, which scales both by the same progress value.
      const warmth = system.heat * hydration;
      // Shared via canvas-ground.ts, so a second opaque canvas cannot be written
      // without the rule this comment states. See canvas-ground.ts.
      const [r, g, b] = groundFor(warmth);

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

      // Everything from here down is the system, and everything above it is
      // the page: the opaque ground and the heat wash have to keep filling the
      // canvas whatever the system is doing.
      //
      // `rise` flattens the scene by scaling it about the horizon. A transform
      // rather than a squashed `sy`, because the suns and worlds draw their
      // glows at fixed pixel radii — a 34px corona, a 4.4px core — so
      // compressing only the projection collapses the *positions* onto a line
      // and leaves round blobs sitting on it. Under the transform the
      // positions, the glows and the trail widths all lose the same
      // dimension together, which is the thing being described: space falls
      // flat and everything caught in it is preserved exactly, just flat.
      ctx.save();
      ctx.translate(0, centerY);
      ctx.scale(1, Math.max(FLAT, rise));
      ctx.translate(0, -centerY);

      // Additive, so trails bloom where the orbits cross.
      ctx.globalCompositeOperation = "lighter";

      // A world that arrived with this civilisation fades in, so a new one
      // arrives rather than popping into place. A world that was already here
      // does not.
      //
      // This used to be `system.settle * hydration` for every world at once,
      // which took the whole system to alpha 0 on the frame a settle began.
      // Two bodies never deserved that: Trisolaris, which `resetInto` deliber-
      // ately carries across a collapse instead of ghosting, and every world
      // of a civilisation that *survived*, where nothing is replaced at all.
      // Both were faded out and back in over five seconds starting from the
      // frame the era notice landed in — so the trails the simulation is
      // careful to carry across were invisible for exactly the moment they
      // exist to cover.
      //
      // The fade runs over WORLD_FADE_TIME rather than the whole settle, so it
      // is the mirror of the ghost fade-out it plays against: a world at 0.3
      // is replacing a ghost at 0.7, and the pair holds a roughly constant
      // brightness instead of dipping through the middle of the cross-fade.
      const arrival = Math.min(1, (system.settle * SETTLE_TIME) / WORLD_FADE_TIME);
      const alphaFor = (planet: Planet) => (planet.fadesIn ? arrival : 1) * hydration;

      // Their paths are thinner and dimmer than the suns', so the eye reads
      // the bright periodic orbit first and the quiet ones second.
      system.planets.forEach((planet) => {
        if (!planet.alive) return;
        const isHome = planet.isHome;
        drawTrail(
          planet.trail,
          isHome ? HOME_COLOR : WORLD_COLOR,
          (isHome ? 0.5 : 0.28) * alphaFor(planet),
          isHome ? 1.1 : 0.7,
          hydration,
        );
      });

      for (let i = 0; i < system.sunTrails.length; i++) {
        drawTrail(system.sunTrails[i], SUN_COLORS[i], 0.9, 2.2, hydration);
      }

      // Worlds that have been destroyed fade out where they died rather than
      // disappearing between two frames.
      system.ghosts.forEach((ghost) => {
        const alpha = Math.max(0, ghost.fade) * hydration;
        // Drawn exactly as it was in life, home world included. A ghost exists
        // to keep a death from being a cut, and demoting Trisolaris to a
        // generic grey world at the instant it dies is the hardest cut on
        // screen — on the one body the design says the eye is tracking.
        drawTrail(
          ghost.trail,
          ghost.isHome ? HOME_COLOR : WORLD_COLOR,
          (ghost.isHome ? 0.5 : 0.28) * alpha,
          ghost.isHome ? 1.1 : 0.7,
          hydration,
        );
        drawWorld(ghost, ghost.isHome, alpha);
      });

      system.planets.forEach((planet) => {
        if (planet.alive) drawWorld(planet, planet.isHome, alphaFor(planet));
      });

      for (let i = 0; i < system.suns.length; i++) {
        drawSun(system.suns[i].x, system.suns[i].y, SUN_COLORS[i]);
      }

      ctx.restore();

      // The horizon, drawn outside the transform because it is already flat —
      // scaling it would collapse the one thing whose job is to be seen.
      //
      // Additive, and set here rather than inherited. The `save()` above is
      // taken *before* the scene sets `lighter`, so `restore()` puts
      // `source-over` back and this block would otherwise paint over the
      // squashed system instead of adding to it — which is the difference
      // between a horizon the system has been pressed onto and an opaque
      // stand-in hiding the fact that it is dim. Stated explicitly because
      // moving that `save()` two lines down is a natural tidy-up, and the
      // silent result would be a horizon that composites the other way.
      ctx.globalCompositeOperation = "lighter";

      // An ellipse rather than a band across the full width: the light has
      // been pressed into the part of the frame the system occupies, so it
      // should fall off towards the edges rather than run out of them.
      if (rise < HORIZON_UNTIL) {
        const t = 1 - rise / HORIZON_UNTIL;
        const strength = t * t * (3 - 2 * t);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(1, 0.035 + rise * 0.4);
        // Sized to the nearer edge, not to the width. `centerX` is 0.73 of the
        // width on the desktop layout, where a reach of 0.42w put the right
        // edge at 0.64 of the gradient — still carrying about alpha 0.16 of
        // near-white when the canvas cut it off. A hard vertical line down one
        // side, held for the first 0.45 of the rise, while the other side
        // faded out properly: the exact failure the paragraph above claims the
        // ellipse was chosen to avoid.
        //
        // Measured: with 0.42w the last column of the canvas reached luminance
        // 41 against a ground of 6, fading through 36 and 15 as the horizon
        // did. Sized to the nearer edge it is 6 — the ground — at every point
        // of the ramp.
        const reach = Math.min(centerX, width - centerX);
        const line = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
        line.addColorStop(0, `rgba(214, 230, 246, ${0.78 * strength})`);
        line.addColorStop(0.35, `rgba(188, 211, 232, ${0.30 * strength})`);
        line.addColorStop(1, `rgba(188, 211, 232, 0)`);
        ctx.fillStyle = line;
        ctx.beginPath();
        ctx.arc(0, 0, reach, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    registerRenderer(render);

    // Re-register rather than only re-measuring. `resize()` assigns
    // `canvas.width`, and assigning it *clears the canvas* even when the value
    // is unchanged — so every resize blanks the hero and something has to
    // paint it again. The frame loop does that on its next tick, but a
    // reduced-motion visitor has no frame loop: their hero is painted exactly
    // once, by the provider's own draw call, and a single resize after that
    // left them with a blank canvas until they navigated away and back.
    //
    // `registerRenderer` already draws immediately when a system exists, which
    // is the same path that covers the mount case: the first `resize()` can
    // measure a canvas the layout has not placed yet, so the provider's draw
    // lands in a 1x1 buffer that the first real resize then throws away.
    const onResize = () => {
      resize();
      registerRenderer(render);
    };
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
