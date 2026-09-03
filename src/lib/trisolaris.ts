/* ---------------------------------------------------------------
   The Trisolaran system.

   Three equal-mass suns under Newtonian gravity, plus one planet of
   negligible mass. The suns are integrated with velocity Verlet; the planet
   is a test particle, pulled by the suns but exerting no force back, which
   keeps the suns' figure-eight solution exact.

   Stable Era  — the suns run the Chenciner-Montgomery figure-eight
                 choreography, a genuine periodic solution. Far from it the
                 three suns look like a single point mass of total mass 3, so
                 a wide planetary orbit is close to a simple Kepler ellipse.
   Chaotic Era — the suns are perturbed. The point-mass approximation breaks
                 and the planet's orbit is torn apart.

   A civilisation ends when the planet is destroyed: flung out of the system
   or falling into a sun.

   One honest caveat: a genuinely chaotic three-body system never returns to
   a periodic orbit on its own. So when a civilisation *survives* a Chaotic
   Era, the suns are re-seeded to the figure-eight to represent the next
   Stable Era arriving. Everything inside an era is real integration; that
   one re-seed is a narrative device.
   --------------------------------------------------------------- */

export type Era = "stable" | "chaotic";

export type Body = { x: number; y: number; vx: number; vy: number; ax: number; ay: number };
export type Point = { x: number; y: number };

const G = 1;
/**
 * The suns are integrated with no softening: the figure-eight has no close
 * approaches, and any softening changes the force law enough to visibly break
 * the periodic solution. The planet keeps a small softening because it can
 * pass very near a sun before BURN_RADIUS catches it.
 */
const SUN_SOFTENING = 0;
const PLANET_SOFTENING = 0.02;

/** Integration step, and how many are taken per simulation frame. */
export const DT = 0.0011;
export const SUBSTEPS = 16;
/** Simulation time advanced by one simulation frame. */
export const SIM_FRAME_TIME = DT * SUBSTEPS;

/** Simulation frames per second of real time, independent of display rate. */
export const SIM_HZ = 60;

/** Period of the figure-eight solution, in simulation time. */
export const PERIOD = 6.3259;

/** How long a Stable Era lasts before the suns are perturbed. */
export const STABLE_DURATION = 22;
/** A Chaotic Era the planet survives ends after this much simulation time. */
export const CHAOS_MAX = 9;

/** Velocity kick applied to each sun when a Chaotic Era begins. */
export const PERTURBATION = 0.18;

/**
 * Radius of the planet's initial orbit. Tuned by simulation, not by eye.
 *
 * At 2.4 the orbit stays bound through a Stable Era, never exceeding 2.49.
 * Nearby radii are far worse: measured over 15-minute runs, 2.3 and 2.5 both
 * let the planet leave the system partway through a Stable Era. Chaotic Eras
 * then destroy it 72-88% of the time, so civilisations fall often but not
 * always.
 */
export const PLANET_ORBIT = 2.4;
/**
 * At the end of a Chaotic Era the planet must be within this band for the
 * civilisation to count as having survived. Outside it, the orbit is wrecked
 * beyond recovery and the civilisation is lost.
 */
export const SURVIVABLE_ORBIT: readonly [number, number] = [1.8, 3.2];

/** Beyond this the planet has been flung out of the system. */
export const ESCAPE_RADIUS = 9;
/** Inside this of any sun, the planet is consumed. */
export const BURN_RADIUS = 0.22;

export const SUN_COLORS = ["#e6a94c", "#7fb2ff", "#d4544a"] as const;
export const PLANET_COLOR = "#9fb4c9";

export const SUN_TRAIL_LENGTH = 380;
export const PLANET_TRAIL_LENGTH = 900;

export type System = {
  suns: Body[];
  planet: Body;
  sunTrails: Point[][];
  planetTrail: Point[];
  era: Era;
  /** Simulation time spent in the current era. */
  eraElapsed: number;
  civilization: number;
};

export type SimEvent =
  | { type: "era"; era: Era }
  | { type: "collapse"; civilization: number };

function figureEightSuns(): Body[] {
  const vx = 0.466203685;
  const vy = 0.43236573;
  return [
    { x: 0.97000436, y: -0.24308753, vx, vy, ax: 0, ay: 0 },
    { x: -0.97000436, y: 0.24308753, vx, vy, ax: 0, ay: 0 },
    { x: 0, y: 0, vx: -2 * vx, vy: -2 * vy, ax: 0, ay: 0 },
  ];
}

function newPlanet(): Body {
  // Circular velocity for the combined mass of all three suns, treating them
  // as a single point mass — a good approximation this far out.
  const totalMass = 3;
  const v = Math.sqrt((G * totalMass) / PLANET_ORBIT);
  return { x: PLANET_ORBIT, y: 0, vx: 0, vy: v, ax: 0, ay: 0 };
}

export function createSystem(civilization = 1): System {
  const suns = figureEightSuns();
  computeSunAccelerations(suns);
  const planet = newPlanet();
  computePlanetAcceleration(planet, suns);
  return {
    suns,
    planet,
    sunTrails: [[], [], []],
    planetTrail: [],
    era: "stable",
    eraElapsed: 0,
    civilization,
  };
}

function computeSunAccelerations(suns: Body[]) {
  for (const s of suns) {
    s.ax = 0;
    s.ay = 0;
  }
  for (let i = 0; i < suns.length; i++) {
    for (let j = i + 1; j < suns.length; j++) {
      const a = suns[i];
      const b = suns[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + SUN_SOFTENING;
      const inv = G / (d2 * Math.sqrt(d2));
      a.ax += dx * inv;
      a.ay += dy * inv;
      b.ax -= dx * inv;
      b.ay -= dy * inv;
    }
  }
}

/** The planet is massless: the suns pull it, it pulls nothing. */
function computePlanetAcceleration(planet: Body, suns: Body[]) {
  planet.ax = 0;
  planet.ay = 0;
  for (const s of suns) {
    const dx = s.x - planet.x;
    const dy = s.y - planet.y;
    const d2 = dx * dx + dy * dy + PLANET_SOFTENING;
    const inv = G / (d2 * Math.sqrt(d2));
    planet.ax += dx * inv;
    planet.ay += dy * inv;
  }
}

/** One velocity-Verlet step. Symplectic, so energy stays honest over time. */
function integrate(sys: System, dt: number) {
  const half = 0.5 * dt;

  for (const s of sys.suns) {
    s.vx += s.ax * half;
    s.vy += s.ay * half;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  const p = sys.planet;
  p.vx += p.ax * half;
  p.vy += p.ay * half;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  computeSunAccelerations(sys.suns);
  computePlanetAcceleration(p, sys.suns);

  for (const s of sys.suns) {
    s.vx += s.ax * half;
    s.vy += s.ay * half;
  }
  p.vx += p.ax * half;
  p.vy += p.ay * half;
}

function planetDestroyed(sys: System): boolean {
  const p = sys.planet;
  if (Math.hypot(p.x, p.y) > ESCAPE_RADIUS) return true;
  return sys.suns.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < BURN_RADIUS);
}

/** Knock the suns off the periodic solution. The Chaotic Era begins. */
export function destabilise(sys: System, rand: () => number = Math.random) {
  for (const s of sys.suns) {
    s.vx += (rand() - 0.5) * PERTURBATION;
    s.vy += (rand() - 0.5) * PERTURBATION;
  }
  computeSunAccelerations(sys.suns);
}

function recordTrails(sys: System) {
  for (let i = 0; i < sys.suns.length; i++) {
    const t = sys.sunTrails[i];
    t.push({ x: sys.suns[i].x, y: sys.suns[i].y });
    if (t.length > SUN_TRAIL_LENGTH) t.shift();
  }
  sys.planetTrail.push({ x: sys.planet.x, y: sys.planet.y });
  if (sys.planetTrail.length > PLANET_TRAIL_LENGTH) sys.planetTrail.shift();
}

/**
 * Advance the system by whole simulation frames, returning any events that
 * occurred. Mutates `sys` in place, including replacing it wholesale when a
 * civilisation collapses.
 */
export function advance(
  sys: System,
  frames: number,
  rand: () => number = Math.random,
): SimEvent[] {
  const events: SimEvent[] = [];

  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < SUBSTEPS; i++) integrate(sys, DT);
    sys.eraElapsed += SIM_FRAME_TIME;
    recordTrails(sys);

    if (planetDestroyed(sys)) {
      const next = sys.civilization + 1;
      events.push({ type: "collapse", civilization: sys.civilization });
      resetInto(sys, next);
      events.push({ type: "era", era: "stable" });
      continue;
    }

    if (sys.era === "stable") {
      if (sys.eraElapsed >= STABLE_DURATION) {
        destabilise(sys, rand);
        sys.era = "chaotic";
        sys.eraElapsed = 0;
        events.push({ type: "era", era: "chaotic" });
      }
      continue;
    }

    // Chaotic Era: long enough has passed for it to break, one way or another.
    if (sys.eraElapsed >= CHAOS_MAX) {
      const radius = Math.hypot(sys.planet.x, sys.planet.y);

      // Surviving means the orbit is still recoverable. A planet flung onto a
      // wild ellipse hasn't survived in any meaningful sense — it just hasn't
      // finished dying, and letting it through leaves it wandering far off
      // screen during what the UI is calling a Stable Era.
      if (radius < SURVIVABLE_ORBIT[0] || radius > SURVIVABLE_ORBIT[1]) {
        const next = sys.civilization + 1;
        events.push({ type: "collapse", civilization: sys.civilization });
        resetInto(sys, next);
        events.push({ type: "era", era: "stable" });
        continue;
      }

      // The civilisation survived: re-seed the whole system for the next
      // Stable Era, keeping the civilisation number (see the note at the top).
      //
      // The planet returns to the canonical starting angle rather than staying
      // where chaos left it. Stability depends on the planet's phase relative
      // to the figure-eight, so an arbitrary angle is an unvalidated initial
      // condition — measured runs from other angles wander out of the system
      // partway through the following Stable Era.
      resetInto(sys, sys.civilization);
      events.push({ type: "era", era: "stable" });
    }
  }

  return events;
}

function resetInto(sys: System, civilization: number) {
  const fresh = createSystem(civilization);
  sys.suns = fresh.suns;
  sys.planet = fresh.planet;
  sys.sunTrails = fresh.sunTrails;
  sys.planetTrail = fresh.planetTrail;
  sys.era = "stable";
  sys.eraElapsed = 0;
  sys.civilization = civilization;
}
