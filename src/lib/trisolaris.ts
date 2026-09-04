/* ---------------------------------------------------------------
   The Trisolaran system.

   Three equal-mass suns under Newtonian gravity, plus one planet of
   negligible mass. The suns are integrated with velocity Verlet; the planet
   is a test particle, pulled by the suns but exerting no force back, which
   keeps the suns' periodic solution exact.

   Stable Era  — the suns run a genuine periodic solution, so the orbit
                 closes on itself and the planet's wide orbit is nearly
                 circular.
   Chaotic Era — the suns are perturbed. The orbit stops closing, and the
                 planet is usually destroyed.

   A civilisation ends when the planet is destroyed, and the cause is read
   out of the simulation state rather than chosen at random.

   One honest caveat: a genuinely chaotic three-body system never returns to
   a periodic orbit on its own. So when a civilisation *survives* a Chaotic
   Era, the system is re-seeded to represent the next Stable Era arriving.
   Everything inside an era is real integration; that re-seed is the one
   narrative device.
   --------------------------------------------------------------- */

export type Era = "stable" | "chaotic";

export type Body = { x: number; y: number; vx: number; vy: number; ax: number; ay: number };
export type Point = { x: number; y: number };

const G = 1;
/**
 * The suns are integrated with no softening: these solutions have no close
 * approaches, and softening changes the force law enough to visibly break the
 * periodicity. The planet keeps a small softening because it can pass very
 * near a sun before BURN_RADIUS catches it.
 */
const SUN_SOFTENING = 0;
const PLANET_SOFTENING = 0.02;

/** Integration step, and how many are taken per simulation frame. */
export const DT = 0.00055;
export const SUBSTEPS = 32;
/** Simulation time advanced by one simulation frame. */
export const SIM_FRAME_TIME = DT * SUBSTEPS;

/** Simulation frames per second of real time, independent of display rate. */
export const SIM_HZ = 60;

/** A Chaotic Era the planet survives ends after this much simulation time. */
export const CHAOS_MAX = 9;
/** Velocity kick applied to each sun when a Chaotic Era begins. */
export const PERTURBATION = 0.7;

/** Beyond this the planet has been flung out of the system. */
export const ESCAPE_RADIUS = 12;
/**
 * Beyond this a sun has escaped and the system has come apart. Without this
 * check the suns wander to hundreds of world units during a Chaotic Era and
 * simply leave the frame.
 */
export const SUN_ESCAPE_RADIUS = 6;
/** Inside this of any sun, the planet is consumed. */
export const BURN_RADIUS = 0.22;
/** Suns closer together than this count as a conjunction — a tri-solar day. */
export const SYZYGY_SPREAD = 0.75;
/** How near the planet must be to a conjunction to be cooked by it. */
export const SYZYGY_RANGE = 1.7;

export const SUN_COLORS = ["#e6a94c", "#7fb2ff", "#d4544a"] as const;
export const PLANET_COLOR = "#9fb4c9";

/**
 * Periodic solutions for three equal masses, in the collinear parameterisation
 *   r1 = (-1,0), r2 = (1,0), r3 = (0,0);  v1 = v2 = (vx,vy);  v3 = -2(vx,vy)
 *
 * Only solutions verified here are included. Both close to within 0.006 over
 * three periods under this integrator. `planetOrbit` was found by sweeping
 * radii and keeping one where the planet stays on a near-circular path for a
 * whole Stable Era: the figure-eight holds to a spread of x1.00 at 3.4, and
 * the moth to x1.16 at 4.4. Radii between are markedly worse for both.
 */
export type Orbit = {
  id: string;
  name: string;
  cjk: string;
  vx: number;
  vy: number;
  period: number;
  planetOrbit: number;
  /** How long this orbit's Stable Era runs, in simulation time. */
  stableDuration: number;
};

export const ORBITS: readonly Orbit[] = [
  {
    id: "figure-eight",
    name: "Figure-Eight",
    cjk: "八字",
    vx: 0.3471128135672417,
    vy: 0.5327261568568347,
    period: 6.3259,
    planetOrbit: 3.4,
    stableDuration: 22,
  },
  {
    id: "moth",
    name: "Moth",
    cjk: "飞蛾",
    vx: 0.46444,
    vy: 0.39606,
    period: 14.8939,
    planetOrbit: 4.4,
    stableDuration: 30,
  },
];

export type CollapseCause = "fire" | "cold" | "starless" | "syzygy" | "drift";

export type System = {
  orbit: Orbit;
  suns: Body[];
  planet: Body;
  sunTrails: Point[][];
  planetTrail: Point[];
  /** Exactly one period, so the trail closes on itself instead of doubling. */
  sunTrailLength: number;
  planetTrailLength: number;
  era: Era;
  /** Simulation time spent in the current era. */
  eraElapsed: number;
  civilization: number;
};

export type SimEvent =
  | { type: "era"; era: Era }
  | { type: "collapse"; civilization: number; cause: CollapseCause };

function sunsFor(orbit: Orbit): Body[] {
  return [
    { x: -1, y: 0, vx: orbit.vx, vy: orbit.vy, ax: 0, ay: 0 },
    { x: 1, y: 0, vx: orbit.vx, vy: orbit.vy, ax: 0, ay: 0 },
    { x: 0, y: 0, vx: -2 * orbit.vx, vy: -2 * orbit.vy, ax: 0, ay: 0 },
  ];
}

function planetFor(orbit: Orbit): Body {
  // Circular velocity for the combined mass of all three suns, treating them
  // as a single point mass — a good approximation this far out.
  const v = Math.sqrt((G * 3) / orbit.planetOrbit);
  return { x: orbit.planetOrbit, y: 0, vx: 0, vy: v, ax: 0, ay: 0 };
}

/** Each civilisation inherits a different periodic solution, in rotation. */
export function orbitForCivilization(civilization: number): Orbit {
  return ORBITS[(civilization - 1) % ORBITS.length];
}

export function createSystem(civilization = 1): System {
  const orbit = orbitForCivilization(civilization);
  const suns = sunsFor(orbit);
  computeSunAccelerations(suns);
  const planet = planetFor(orbit);
  computePlanetAcceleration(planet, suns);

  const planetPeriod = (2 * Math.PI * orbit.planetOrbit) / Math.sqrt(3 / orbit.planetOrbit);

  return {
    orbit,
    suns,
    planet,
    sunTrails: [[], [], []],
    planetTrail: [],
    sunTrailLength: Math.round(orbit.period / SIM_FRAME_TIME),
    planetTrailLength: Math.round(planetPeriod / SIM_FRAME_TIME),
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

/** Largest distance between any two suns — small means a conjunction. */
function sunSpread(suns: Body[]): number {
  let max = 0;
  for (let i = 0; i < suns.length; i++) {
    for (let j = i + 1; j < suns.length; j++) {
      max = Math.max(max, Math.hypot(suns[i].x - suns[j].x, suns[i].y - suns[j].y));
    }
  }
  return max;
}

/**
 * Why this world died, read from the state at the moment of destruction
 * rather than picked at random.
 */
function causeOfDeath(sys: System): CollapseCause | null {
  const p = sys.planet;
  const nearest = Math.min(...sys.suns.map((s) => Math.hypot(s.x - p.x, s.y - p.y)));
  const spread = sunSpread(sys.suns);

  // A tri-solar day: all three suns bunched together with the world close by.
  // It doesn't have to fall into one of them to be cooked.
  if (spread < SYZYGY_SPREAD && nearest < SYZYGY_RANGE) return "syzygy";

  if (nearest < BURN_RADIUS) return "fire";
  if (Math.hypot(p.x, p.y) > ESCAPE_RADIUS) return "cold";
  // A sun escaping strands the world in the dark just as surely.
  if (sys.suns.some((s) => Math.hypot(s.x, s.y) > SUN_ESCAPE_RADIUS)) return "starless";
  return null;
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
    if (t.length > sys.sunTrailLength) t.shift();
  }
  sys.planetTrail.push({ x: sys.planet.x, y: sys.planet.y });
  if (sys.planetTrail.length > sys.planetTrailLength) sys.planetTrail.shift();
}

function resetInto(sys: System, civilization: number) {
  const fresh = createSystem(civilization);
  sys.orbit = fresh.orbit;
  sys.suns = fresh.suns;
  sys.planet = fresh.planet;
  sys.sunTrails = fresh.sunTrails;
  sys.planetTrail = fresh.planetTrail;
  sys.sunTrailLength = fresh.sunTrailLength;
  sys.planetTrailLength = fresh.planetTrailLength;
  sys.era = "stable";
  sys.eraElapsed = 0;
  sys.civilization = civilization;
}

/**
 * Advance the system by whole simulation frames, returning any events that
 * occurred. Mutates `sys` in place, including replacing its contents when a
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

    const cause = causeOfDeath(sys);
    if (cause) {
      const destroyed = sys.civilization;
      events.push({ type: "collapse", civilization: destroyed, cause });
      resetInto(sys, destroyed + 1);
      events.push({ type: "era", era: "stable" });
      continue;
    }

    if (sys.era === "stable") {
      if (sys.eraElapsed >= sys.orbit.stableDuration) {
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
      const home = sys.orbit.planetOrbit;

      // Surviving means the orbit is still recoverable. A planet flung onto a
      // wild ellipse hasn't survived in any meaningful sense — it just hasn't
      // finished dying, and letting it through leaves it wandering far off
      // screen during what the UI is calling a Stable Era.
      if (radius < home * 0.6 || radius > home * 1.5) {
        const destroyed = sys.civilization;
        events.push({ type: "collapse", civilization: destroyed, cause: "drift" });
        resetInto(sys, destroyed + 1);
        events.push({ type: "era", era: "stable" });
        continue;
      }

      // The civilisation survived: re-seed for the next Stable Era, keeping the
      // civilisation number. The planet returns to the canonical starting angle
      // because stability depends on its phase relative to the suns, so an
      // arbitrary angle is an unvalidated initial condition.
      resetInto(sys, sys.civilization);
      events.push({ type: "era", era: "stable" });
    }
  }

  return events;
}
