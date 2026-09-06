/* ---------------------------------------------------------------
   The Trisolaran system.

   Three equal-mass suns under Newtonian gravity, plus a handful of planets
   of negligible mass. The suns are integrated with velocity Verlet; the
   planets are test particles, pulled by the suns but exerting no force back,
   which keeps the suns' periodic solution exact.

   In the novel the system began with twelve planets and the suns swallowed
   eleven of them, leaving only Trisolaris. Here each civilisation starts
   with a few worlds; the Chaotic Eras take them one at a time, and the
   civilisation ends when the home world itself is destroyed.

   Stable Era  — the suns run a genuine periodic solution, so the orbit
                 closes on itself and the worlds hold their paths.
   Chaotic Era — the suns are perturbed. The orbit stops closing and the
                 worlds are torn out of their orbits.

   Two honest caveats:

   1. A genuinely chaotic three-body system never returns to a periodic
      orbit on its own. When an era ends, the suns are eased back onto the
      periodic solution over SETTLE_TIME rather than snapping — smooth, but
      it is a narrative device, not physics.
   2. Planetary orbits have to sit well outside the suns. Anything closer
      than about 3x the suns' own reach is ejected or swallowed within a
      single Stable Era; the innermost radius here is the closest one
      measured to survive. The gap is real, and it is exactly why Trisolaris
      is such a miserable place to live.
   --------------------------------------------------------------- */

export type Era = "stable" | "chaotic";

export type Body = { x: number; y: number; vx: number; vy: number; ax: number; ay: number };
export type Point = { x: number; y: number };

const G = 1;
/**
 * Just enough softening to remove the singularity at d -> 0, and no more.
 *
 * With none at all a close encounter is unintegrable at any fixed step: the
 * force diverges, energy conservation fails, and a sun departs at 174 units
 * per unit time — crossing the whole frame in a couple of displayed frames.
 * Larger values fix that but deform the force law enough to break the periodic
 * solutions.
 *
 * 5e-5 was measured as the best point on every axis at once. It drops peak
 * speed to 11.75, and it *improves* both orbits rather than degrading them:
 * figure-eight closure drift 0.003 -> 0.001, moth 0.089 -> 0.050. The moth
 * passes within 0.079 of itself, close enough that the bare singularity was
 * costing it accuracy.
 */
const SUN_SOFTENING = 0.00005;
const PLANET_SOFTENING = 0.02;

/** Integration step, and how many are taken per simulation frame. */
export const DT = 0.00055;
export const SUBSTEPS = 32;
/** Simulation time advanced by one simulation frame. */
export const SIM_FRAME_TIME = DT * SUBSTEPS;

/** Simulation frames per second of real time, independent of display rate. */
export const SIM_HZ = 60;

/** A Chaotic Era the home world survives ends after this much sim time. */
export const CHAOS_MAX = 18;
/** How long the suns take to orbit back onto the periodic solution. */
export const SETTLE_TIME = 5;

/**
 * Time constants for `heat`, the 0..1 value the whole site's colour derives
 * from. Heat rises faster than it falls on purpose: chaos should arrive as an
 * event and recede as a long cooling, rather than snapping back.
 */
export const HEAT_RISE = 2.6;
export const HEAT_FALL = 7;
/** Velocity kick applied to each sun when a Chaotic Era begins. */
export const PERTURBATION = 0.8;
/**
 * The kick is spread over this much simulation time rather than applied as an
 * impulse. Delivered in one frame it is a visible kink: the suns are on a
 * closed orbit and then, between two frames, they are not.
 */
export const PERTURB_RAMP = 1.4;
/** How long a destroyed world and its trail take to fade out. */
export const WORLD_FADE_TIME = 1.6;

/**
 * Adaptive time-stepping for close encounters.
 *
 * A fixed step cannot follow two suns slinging past each other: the force
 * spikes, the integrator loses energy conservation, and a sun leaves at
 * hundreds of units per unit time. Measured, the fastest ejections crossed the
 * whole visible frame in 0.026s — around a single displayed frame, which reads
 * as a teleport rather than an ejection.
 *
 * Above SPEED_REFERENCE the step shrinks in proportion, which is both the
 * standard remedy for close encounters and the reason the moment becomes
 * watchable: the physics is unchanged, it is played at a slower rate.
 */
export const SPEED_REFERENCE = 2.4;
/** The simulation will not run slower than this fraction of normal. */
export const MIN_TIME_SCALE = 0.035;

/**
 * A planet is gone once it passes this multiple of the system's outermost
 * orbit — just beyond the edge of the frame, which is itself sized from that
 * same radius.
 *
 * It cannot be one fixed distance for both solutions: the figure-eight's outer
 * world sits at 4.2 and the moth's at 6.0, so any constant is either inside
 * one frame or far outside the other. At a flat 14 the home world was off
 * screen for a mean of 5.7s — up to 24s — before its death registered, and the
 * notice arrived long after the moment it described.
 */
export const ESCAPE_FACTOR = 1.32;

export function escapeRadiusFor(orbit: Orbit): number {
  return orbit.planetRadii[orbit.planetRadii.length - 1] * ESCAPE_FACTOR;
}
/**
 * Beyond this a sun has escaped and the system has come apart. Without this
 * check the suns wander to hundreds of world units and leave the frame.
 */
export const SUN_ESCAPE_RADIUS = 6;
/**
 * At the end of a Chaotic Era the home world must be within this fraction of
 * its own orbit for the civilisation to count as having survived. The upper
 * bound sits just inside ESCAPE_FACTOR, so a world beyond it has generally
 * escaped and died of cold already rather than waiting for the timeout.
 */
export const SURVIVABLE_BAND: readonly [number, number] = [0.55, 1.72];

/**
 * A sun further out than this when a civilisation falls is pulled back before
 * the settle begins. Set equal to SUN_ESCAPE_RADIUS, which is the furthest a
 * sun ever gets, so in practice nothing is ever moved and the glide always
 * starts from exactly where the sun was.
 */
export const SETTLE_START_RADIUS = SUN_ESCAPE_RADIUS;

/** Inside this of any sun, a planet is consumed. */
export const BURN_RADIUS = 0.22;
/** Suns closer together than this count as a conjunction — a tri-solar day. */
export const SYZYGY_SPREAD = 0.75;
/** How near the home world must be to a conjunction to be cooked by it. */
export const SYZYGY_RANGE = 1.7;

export const SUN_COLORS = ["#e6a94c", "#7fb2ff", "#d4544a"] as const;
/** The home world. Deliberately the brightest, coolest thing on screen. */
export const HOME_COLOR = "#bcd3e8";
/** Every other world: dimmer and greyer, so Trisolaris reads first. */
export const WORLD_COLOR = "#6b7183";

/**
 * Periodic solutions for three equal masses, in the collinear parameterisation
 *   r1 = (-1,0), r2 = (1,0), r3 = (0,0);  v1 = v2 = (vx,vy);  v3 = -2(vx,vy)
 *
 * `planetRadii[0]` is Trisolaris. Every radius here was measured over five
 * Stable Eras and kept only if the orbit stayed bound; the gaps between them
 * are not aesthetic, they are the radii that survive. The figure-eight holds
 * worlds from 3.0 outward, the moth only from 4.6, which is why its system
 * looks so much wider.
 */
export type Orbit = {
  id: string;
  name: string;
  cjk: string;
  vx: number;
  vy: number;
  period: number;
  planetRadii: number[];
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
    planetRadii: [3.0, 3.6, 4.2],
    stableDuration: 16,
  },
  {
    id: "moth",
    name: "Moth",
    cjk: "飞蛾",
    vx: 0.46444,
    vy: 0.39606,
    period: 14.8939,
    planetRadii: [4.6, 6.0],
    stableDuration: 20,
  },
];

export type CollapseCause = "fire" | "cold" | "starless" | "syzygy" | "drift";

export type Planet = Body & {
  /** The radius this world was placed at. */
  home: number;
  /**
   * True for Trisolaris. Carried on the world itself because being home is
   * positional — `planets[0]` — and a ghost has been lifted out of that array
   * and lost its index by the time anything draws it.
   */
  isHome: boolean;
  alive: boolean;
  trail: Point[];
  /** 1 while present, easing to 0 once destroyed. */
  fade: number;
};

export type System = {
  orbit: Orbit;
  suns: Body[];
  /** Index 0 is Trisolaris; the rest are the worlds it will outlive. */
  planets: Planet[];
  sunTrails: Point[][];
  sunTrailLength: number;
  planetTrailLength: number;
  era: Era;
  /** Simulation time spent in the current era. */
  eraElapsed: number;
  civilization: number;
  /**
   * Held open by the visitor. While set, a Stable Era is re-anchored onto the
   * periodic solution rather than perturbed, and never ends. See `advance`.
   */
  pinned: boolean;
  /**
   * 1 while an era is running normally. Drops to 0 when an era ends and eases
   * back to 1 over SETTLE_TIME, while the suns orbit back onto the periodic
   * solution and new worlds fade in instead of appearing.
   */
  settle: number;
  /**
   * A shadow copy of the system running the periodic solution from its
   * validated initial conditions. While settling, the real bodies are blended
   * toward it — and because the shadow is itself orbiting, they curve back
   * into formation rather than sliding there in straight lines.
   */
  shadow: { suns: Body[]; planets: Planet[] } | null;
  /**
   * 0 when cold, 1 at the height of a Chaotic Era. Everything the visitor sees
   * change colour is driven from this one number, so the shift is continuous
   * in both directions instead of switching between two palettes.
   */
  heat: number;
  /**
   * Current simulation rate as a fraction of normal. Drops below 1 during a
   * close encounter, when the step has to shrink to stay accurate.
   */
  timeScale: number;
  /** The last cause reported, so a repeat can be avoided where possible. */
  lastCause: CollapseCause | null;
  /**
   * Worlds that have been destroyed, kept only to fade out. Not simulated.
   * Without them a world and its trail blink out of existence the instant it
   * dies, which is the most abrupt thing that can happen on screen.
   */
  ghosts: Planet[];
  /**
   * Velocity still to be delivered to each sun, and the time left to deliver
   * it over. Spreading the kick keeps the start of a Chaotic Era continuous.
   */
  kick: { dvx: number; dvy: number }[] | null;
  kickRemaining: number;
};

export type SimEvent =
  | { type: "era"; era: Era }
  | { type: "collapse"; civilization: number; cause: CollapseCause }
  /**
   * The home world came through a Chaotic Era. Measured, 43% of them end this
   * way, and without an event for it the outcome was reported by nothing —
   * indistinguishable on screen from a death whose notice had failed.
   */
  | { type: "survived"; civilization: number }
  | { type: "worldLost"; remaining: number };

function sunsFor(orbit: Orbit): Body[] {
  return [
    { x: -1, y: 0, vx: orbit.vx, vy: orbit.vy, ax: 0, ay: 0 },
    { x: 1, y: 0, vx: orbit.vx, vy: orbit.vy, ax: 0, ay: 0 },
    { x: 0, y: 0, vx: -2 * orbit.vx, vy: -2 * orbit.vy, ax: 0, ay: 0 },
  ];
}

function planetsFor(orbit: Orbit): Planet[] {
  // Spread the starting angles so the worlds don't line up like a diagram.
  return orbit.planetRadii.map((home, i) => {
    const angle = (i / orbit.planetRadii.length) * Math.PI * 2;
    const v = Math.sqrt((G * 3) / home);
    return {
      x: home * Math.cos(angle),
      y: home * Math.sin(angle),
      vx: -v * Math.sin(angle),
      vy: v * Math.cos(angle),
      ax: 0,
      ay: 0,
      home,
      isHome: i === 0,
      alive: true,
      trail: [],
      fade: 1,
    };
  });
}

/** Each civilisation inherits a different periodic solution, in rotation. */
export function orbitForCivilization(civilization: number): Orbit {
  return ORBITS[(civilization - 1) % ORBITS.length];
}

export function createSystem(civilization = 1): System {
  const orbit = orbitForCivilization(civilization);
  const suns = sunsFor(orbit);
  computeSunAccelerations(suns);
  const planets = planetsFor(orbit);
  for (const p of planets) computePlanetAcceleration(p, suns);

  const home = orbit.planetRadii[0];
  const homePeriod = (2 * Math.PI * home) / Math.sqrt(3 / home);

  return {
    orbit,
    suns,
    planets,
    sunTrails: [[], [], []],
    sunTrailLength: Math.round(orbit.period / SIM_FRAME_TIME),
    // Part of an orbit rather than all of it: a full one closes into a ring
    // wide enough to reach across the hero and collide with the text.
    planetTrailLength: Math.round((homePeriod * 0.34) / SIM_FRAME_TIME),
    era: "stable",
    eraElapsed: 0,
    civilization,
    pinned: false,
    settle: 1,
    shadow: null,
    heat: 0,
    timeScale: 1,
    lastCause: null,
    ghosts: [],
    kick: null,
    kickRemaining: 0,
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

/** Planets are massless: the suns pull them, they pull nothing. */
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

/** Move `body` a fraction `w` of the way onto `target`, in place. */
function blendToward(body: Body, target: Body, w: number) {
  body.x += (target.x - body.x) * w;
  body.y += (target.y - body.y) * w;
  body.vx += (target.vx - body.vx) * w;
  body.vy += (target.vy - body.vy) * w;
}

/** One velocity-Verlet step over a bare set of bodies — used by the shadow. */
function integrateBodies(suns: Body[], planets: Body[], dt: number) {
  const half = 0.5 * dt;
  for (const s of suns) {
    s.vx += s.ax * half;
    s.vy += s.ay * half;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  for (const p of planets) {
    p.vx += p.ax * half;
    p.vy += p.ay * half;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  computeSunAccelerations(suns);
  for (const p of planets) computePlanetAcceleration(p, suns);
  for (const s of suns) {
    s.vx += s.ax * half;
    s.vy += s.ay * half;
  }
  for (const p of planets) {
    p.vx += p.ax * half;
    p.vy += p.ay * half;
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
  for (const p of sys.planets) {
    if (!p.alive) continue;
    p.vx += p.ax * half;
    p.vy += p.ay * half;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  computeSunAccelerations(sys.suns);
  for (const p of sys.planets) {
    if (p.alive) computePlanetAcceleration(p, sys.suns);
  }

  for (const s of sys.suns) {
    s.vx += s.ax * half;
    s.vy += s.ay * half;
  }
  for (const p of sys.planets) {
    if (!p.alive) continue;
    p.vx += p.ax * half;
    p.vy += p.ay * half;
  }
}

/**
 * How much to shrink the step this frame. Driven by the fastest body, since
 * speed is what both breaks the integrator and outruns the display.
 */
function timeScaleFor(sys: System): number {
  let fastest = 0;
  for (const s of sys.suns) fastest = Math.max(fastest, Math.hypot(s.vx, s.vy));
  for (const p of sys.planets) {
    if (p.alive) fastest = Math.max(fastest, Math.hypot(p.vx, p.vy));
  }
  if (fastest <= SPEED_REFERENCE) return 1;
  return Math.max(MIN_TIME_SCALE, SPEED_REFERENCE / fastest);
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
 * Every fate that is true of this world right now, read from the state rather
 * than picked at random. More than one can apply at once — a world falling
 * into a sun during a conjunction is both burning and caught in a syzygy.
 */
function fatesOf(planet: Planet, sys: System): CollapseCause[] {
  const nearest = Math.min(
    ...sys.suns.map((s) => Math.hypot(s.x - planet.x, s.y - planet.y)),
  );
  const fates: CollapseCause[] = [];

  // A tri-solar day: all three suns bunched together with the world close by.
  // It doesn't have to fall into one of them to be cooked.
  if (sunSpread(sys.suns) < SYZYGY_SPREAD && nearest < SYZYGY_RANGE) fates.push("syzygy");
  if (nearest < BURN_RADIUS) fates.push("fire");
  const radius = Math.hypot(planet.x, planet.y);
  if (radius > escapeRadiusFor(sys.orbit)) fates.push("cold");
  // A sun escaping strands every world in the dark just as surely.
  if (sys.suns.some((s) => Math.hypot(s.x, s.y) > SUN_ESCAPE_RADIUS)) fates.push("starless");
  return fates;
}

/**
 * Every way of describing a death that holds, including ones that are true but
 * not themselves lethal. A world dies of fire or cold; that its orbit was also
 * long past saving is equally true, and gives pickFate an honest alternative
 * to reach for rather than repeating the previous cause.
 */
function describeFates(planet: Planet, sys: System, lethal: CollapseCause[]): CollapseCause[] {
  const radius = Math.hypot(planet.x, planet.y);
  const wrecked = radius < planet.home * SURVIVABLE_BAND[0] || radius > planet.home * SURVIVABLE_BAND[1];
  return wrecked ? [...lethal, "drift"] : lethal;
}

/**
 * Choose which true fate to report, preferring not to repeat the last one.
 *
 * Only ever picks from causes that actually hold, so the notice never claims
 * something that didn't happen. When the sole true fate is the one just
 * reported it is used again — a run of identical deaths is better than a
 * false description of one.
 */
function pickFate(fates: CollapseCause[], last: CollapseCause | null): CollapseCause {
  return fates.find((f) => f !== last) ?? fates[0];
}

/**
 * Knock the suns off the periodic solution. The Chaotic Era begins.
 *
 * The kick is queued rather than applied: delivered as an impulse it puts a
 * visible kink in three orbits at once, which is the one moment of the cycle
 * the eye is already watching.
 */
export function destabilise(sys: System, rand: () => number = Math.random) {
  sys.kick = sys.suns.map(() => ({
    dvx: (rand() - 0.5) * PERTURBATION,
    dvy: (rand() - 0.5) * PERTURBATION,
  }));
  sys.kickRemaining = PERTURB_RAMP;
}

/** Deliver this frame's share of a queued perturbation. */
function applyKick(sys: System, dt: number) {
  if (!sys.kick || sys.kickRemaining <= 0) return;
  const share = Math.min(1, dt / sys.kickRemaining);
  sys.suns.forEach((sun, i) => {
    const k = sys.kick![i];
    sun.vx += k.dvx * share;
    sun.vy += k.dvy * share;
    k.dvx -= k.dvx * share;
    k.dvy -= k.dvy * share;
  });
  sys.kickRemaining -= dt;
  if (sys.kickRemaining <= 0) sys.kick = null;
  computeSunAccelerations(sys.suns);
}

/** Retire a world into the ghost list so it fades rather than vanishing. */
function killWorld(sys: System, planet: Planet) {
  planet.alive = false;
  sys.ghosts.push({ ...planet, trail: planet.trail.slice(), fade: 1 });
}

/** Ease out every ghost, dropping the ones that have finished. */
function decayGhosts(sys: System, dt: number) {
  if (sys.ghosts.length === 0) return;
  for (const g of sys.ghosts) g.fade -= dt / WORLD_FADE_TIME;
  sys.ghosts = sys.ghosts.filter((g) => g.fade > 0);
}

function recordSunTrails(sys: System) {
  for (let i = 0; i < sys.suns.length; i++) {
    const t = sys.sunTrails[i];
    t.push({ x: sys.suns[i].x, y: sys.suns[i].y });
    // Down to the limit, not by a single point. Every collapse switches orbit,
    // and moth -> figure-eight drops the limit from 846 to 359: push-then-shift
    // -one nets zero, so the trail would stay 2.36 laps long for the whole of
    // the next civilisation, and drawTrail's one-period alpha ramp with it.
    if (t.length > sys.sunTrailLength) t.splice(0, t.length - sys.sunTrailLength);
  }
}

function recordTrails(sys: System) {
  recordSunTrails(sys);
  for (const p of sys.planets) {
    if (!p.alive) continue;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > sys.planetTrailLength) p.trail.shift();
  }
}

/**
 * Start the return to a Stable Era. A shadow system is spun up on the periodic
 * solution and the real bodies are blended toward it over SETTLE_TIME.
 */
function beginSettle(sys: System) {
  const suns = sunsFor(sys.orbit);
  computeSunAccelerations(suns);
  const planets = planetsFor(sys.orbit);
  for (const p of planets) computePlanetAcceleration(p, suns);

  sys.shadow = { suns, planets };
  sys.settle = 0;
  sys.era = "stable";
  sys.eraElapsed = 0;
}

function resetInto(sys: System, civilization: number, cause: CollapseCause) {
  const from = sys.suns.map((s) => ({ ...s }));
  const heat = sys.heat;
  const pinned = sys.pinned;

  // Everything still standing fades out rather than disappearing, and the sun
  // trails carry over — clearing them made the figure-eight blink out of
  // existence on every collapse.
  const ghosts = [
    ...sys.ghosts,
    ...sys.planets
      .filter((pl) => pl.alive)
      .map((pl) => ({ ...pl, trail: pl.trail.slice(), fade: 1 })),
  ];
  const sunTrails = sys.sunTrails.map((t) => t.slice());

  Object.assign(sys, createSystem(civilization));
  sys.ghosts = ghosts;
  // Truncated here as well as in recordSunTrails, because this frame's trails
  // were already recorded under the *previous* orbit's limit before the
  // collapse was detected — leaving one frame drawn 2.36 laps long otherwise.
  sys.sunTrails = sunTrails.map((t) =>
    t.length > sys.sunTrailLength ? t.slice(t.length - sys.sunTrailLength) : t,
  );
  // Heat and the last cause belong to the page, not to any one civilisation:
  // heat has to keep cooling across the reset rather than snapping to black.
  sys.heat = heat;
  sys.lastCause = cause;
  // The pin is the visitor's, not the fallen civilisation's.
  sys.pinned = pinned;

  // Always orbit in from wherever chaos left the suns, so a new civilisation
  // arrives without a jump cut. A sun that was ejected is pulled back to the
  // frame edge first and glides in from there — skipping the settle for those
  // was what made an escaped sun snap the whole system back into place.
  beginSettle(sys);
  for (let i = 0; i < sys.suns.length; i++) {
    const s = from[i];
    const d = Math.hypot(s.x, s.y);
    if (d > SETTLE_START_RADIUS) {
      const k = SETTLE_START_RADIUS / d;
      s.x *= k;
      s.y *= k;
    }
    Object.assign(sys.suns[i], s);
  }
  computeSunAccelerations(sys.suns);
}

/**
 * Advance the system by whole simulation frames, returning any events that
 * occurred. Mutates `sys` in place.
 */
export function advance(
  sys: System,
  frames: number,
  rand: () => number = Math.random,
): SimEvent[] {
  const events: SimEvent[] = [];

  for (let f = 0; f < frames; f++) {
    const settling = sys.settle < 1;

    if (settling && sys.shadow) {
      const shadow = sys.shadow;
      sys.settle = Math.min(1, sys.settle + SIM_FRAME_TIME / SETTLE_TIME);

      // Only the shadow integrates. Because it is running the periodic
      // solution, chasing it drags the real bodies along curved paths that
      // converge into the formation — they orbit home rather than sliding
      // there — while staying bounded by the target the whole way.
      //
      // Letting the real bodies integrate as well does not work: a sun leaving
      // a close encounter carries enough speed to cross the frame before any
      // reasonable blend catches it, measured at 386 units against a limit of 6.
      for (let i = 0; i < SUBSTEPS; i++) {
        integrateBodies(shadow.suns, shadow.planets, DT);
      }

      const w = 1 - Math.exp(-SIM_FRAME_TIME / (SETTLE_TIME / 4));
      for (let i = 0; i < sys.suns.length; i++) blendToward(sys.suns[i], shadow.suns[i], w);
      sys.planets.forEach((planet, i) => {
        if (planet.alive) blendToward(planet, shadow.planets[i], w);
      });
      computeSunAccelerations(sys.suns);
      for (const p of sys.planets) {
        if (p.alive) computePlanetAcceleration(p, sys.suns);
      }

      recordTrails(sys);

      if (sys.settle >= 1) {
        // Adopt the shadow outright. Whatever rounding the blend left behind,
        // the era now begins from exactly the validated initial conditions.
        sys.suns = shadow.suns;
        sys.planets.forEach((planet, i) => {
          if (!planet.alive) return;
          const trail = planet.trail;
          Object.assign(planet, shadow.planets[i], { alive: true, trail });
        });
        sys.shadow = null;
      }
    } else {
      // Shrink the step when anything is moving fast, so a slingshot is
      // integrated accurately and shown at a speed the eye can follow.
      //
      // Re-evaluated every sub-step, not once per frame: an encounter can
      // begin and finish inside a single frame's 32 sub-steps, and a rate
      // chosen from the speed beforehand is already stale by then. Measured,
      // per-frame scaling left the worst crossing at 0.027s — unchanged.
      let advanced = 0;
      for (let i = 0; i < SUBSTEPS; i++) {
        const scale = timeScaleFor(sys);
        applyKick(sys, DT * scale);
        integrate(sys, DT * scale);
        advanced += DT * scale;
      }
      recordTrails(sys);
      sys.eraElapsed += advanced;
      sys.timeScale = advanced / SIM_FRAME_TIME;
    }

    if (settling) {
      sys.eraElapsed += SIM_FRAME_TIME;
      sys.timeScale = 1;
    }

    decayGhosts(sys, SIM_FRAME_TIME);

    // Heat trails the era rather than tracking it, and cools far more slowly
    // than it builds, so the page fades back to black instead of cutting.
    const target = sys.era === "chaotic" ? 1 : 0;
    const tau = target > sys.heat ? HEAT_RISE : HEAT_FALL;
    sys.heat += (target - sys.heat) * (1 - Math.exp(-SIM_FRAME_TIME / tau));

    // Worlds are only at risk once the suns are actually moving freely.
    if (!settling) {
      const home = sys.planets[0];
      const homeFates = fatesOf(home, sys);
      if (homeFates.length > 0) {
        const cause = pickFate(describeFates(home, sys, homeFates), sys.lastCause);
        const destroyed = sys.civilization;
        events.push({ type: "collapse", civilization: destroyed, cause });
        resetInto(sys, destroyed + 1, cause);
        events.push({ type: "era", era: "stable" });
        continue;
      }

      for (let i = 1; i < sys.planets.length; i++) {
        const world = sys.planets[i];
        if (!world.alive) continue;
        if (fatesOf(world, sys).length > 0) {
          killWorld(sys, world);
          events.push({
            type: "worldLost",
            remaining: sys.planets.filter((p) => p.alive).length,
          });
        }
      }
    }

    if (sys.era === "stable") {
      if (!settling && sys.eraElapsed >= sys.orbit.stableDuration) {
        // Pinned: re-seed rather than perturb, and the era simply never ends.
        //
        // A Stable Era is only stable because it is rebuilt from validated
        // initial conditions every stableDuration. Refusing to end one instead
        // — which is what forcing the era clock from the UI amounted to — runs
        // the same state forever, and the worlds' orbits are quasi-stable, not
        // closed: measured, the home world wanders out to 1.85x its radius and
        // escapes at 113s, while the page still says "Stable Era".
        //
        // Re-anchoring only the suns is not enough for the same reason. This
        // is the path a Chaotic Era already returns through, so the suns curve
        // back into formation and the worlds fade in rather than jumping.
        if (sys.pinned) {
          beginSettle(sys);
          continue;
        }

        destabilise(sys, rand);
        sys.era = "chaotic";
        sys.eraElapsed = 0;
        events.push({ type: "era", era: "chaotic" });
      }
      continue;
    }

    // Chaotic Era: long enough has passed for it to break, one way or another.
    if (sys.eraElapsed >= CHAOS_MAX) {
      const home = sys.planets[0];
      const radius = Math.hypot(home.x, home.y);

      // Surviving means the orbit is still recoverable. A world flung onto a
      // wild ellipse hasn't survived in any meaningful sense — it just hasn't
      // finished dying, and letting it through leaves it wandering far off
      // screen during what the UI is calling a Stable Era.
      if (radius < home.home * SURVIVABLE_BAND[0] || radius > home.home * SURVIVABLE_BAND[1]) {
        // Whatever else is true of the world right now counts too, so a run of
        // timeouts doesn't report "drift" over and over.
        const cause = pickFate(describeFates(home, sys, [...fatesOf(home, sys), "drift"]), sys.lastCause);
        const destroyed = sys.civilization;
        events.push({ type: "collapse", civilization: destroyed, cause });
        resetInto(sys, destroyed + 1, cause);
        events.push({ type: "era", era: "stable" });
        continue;
      }

      // The civilisation survived. Ease back onto the periodic solution and
      // return the surviving worlds to their *canonical* starting angles, not
      // wherever chaos left them. Stability depends on a world's phase
      // relative to the suns, so an arbitrary angle is an unvalidated initial
      // condition — measured, those wander far enough to be destroyed during
      // the following Stable Era, which is not survival in any useful sense.
      const canonical = planetsFor(sys.orbit);
      sys.planets.forEach((p, i) => {
        if (!p.alive) return;
        Object.assign(p, canonical[i], { alive: true, trail: [] });
      });
      beginSettle(sys);
      events.push({ type: "survived", civilization: sys.civilization });
      events.push({ type: "era", era: "stable" });
    }
  }

  return events;
}
