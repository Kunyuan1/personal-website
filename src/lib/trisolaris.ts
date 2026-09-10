/* ---------------------------------------------------------------
   The Trisolaran system.

   Three equal-mass suns under Newtonian gravity, plus a handful of planets
   of negligible mass. The suns are integrated with velocity Verlet; the
   planets are test particles, pulled by the suns but exerting no force back,
   which keeps the suns' periodic solution exact.

   In the novel the system began with twelve planets and the suns swallowed
   eleven of them, leaving only Trisolaris. That division is kept here. The
   outer worlds are destroyed — swallowed or thrown clear — one at a time,
   which is what happened to the eleven. Trisolaris is not. A civilisation on
   it ends when the sky it stands under becomes unliveable for long enough:
   too much light, too little, or an orbit too wrecked to dehydrate through.
   The world survives every one of them, as it does for two hundred
   civilisations in the books, and the counter is counting civilisations
   rather than planets.

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

/**
 * A Chaotic Era the home world survives ends after this much sim time — which
 * is to say, how long a civilisation has to hold its orbit to come through one.
 *
 * It was 18 while survival was decided by a single reading at the end. Judged
 * over the whole era instead, 18 units of a PERTURBATION-sized kick is close
 * to unsurvivable: measured across the report seeds, mortality went from 57%
 * to 88%, and a Chaotic Era nothing lives through stops being a hazard and
 * becomes a countdown. At 12 it is 66% — chaos still usually wins, which is
 * the point of the place, but holding on is a real outcome rather than a
 * rounding error.
 *
 * The kick was left alone deliberately. Weakening it would have bought the
 * same mortality by making every era gentler, deaths included; shortening the
 * window leaves the violence where it is and asks less of the survivors.
 */
export const CHAOS_MAX = 12;
/**
 * How long the suns take to orbit back onto the periodic solution.
 *
 * No longer the arrival-quality knob it reads as. Under `blendWeight`'s
 * envelope the gap runs 1, 0.311, 0.068, 0.0078, 0 across s = 0, 1/4, 1/2,
 * 3/4, 1 — so 93% of the arrival is done by the halfway point and the last
 * couple of seconds are bodies already sitting on the shadow. Changing this
 * number barely moves how well the settle arrives.
 *
 * What it does move, and what any sweep of it should be judged on:
 *
 *   - The first blend frame, which scales as 1/SETTLE_TIME. That is the real
 *     smoothness lever now: it sets how hard a body is yanked out of chaos,
 *     and the harness bounds it — halving this doubles it, from 0.151 to 0.311
 *     against a limit of 0.3, and `the animation never whips` goes red.
 *   - `worldAlpha`'s fade of an arriving world, which is capped at
 *     WORLD_FADE_TIME but starts here.
 *   - `eraElapsed`, which accrues while settling and so eats into the Stable
 *     Era that follows.
 */
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
/**
 * What a Chaotic Era does to the people living through it.
 *
 * A civilisation is not ended by a distance. It is ended by standing in too
 * much light or too little of it, for too long — which is what the books
 * describe and what the visitor is actually watching. Both thresholds are
 * multiples of the home world's *own* Stable Era flux band, because the two
 * periodic solutions are not remotely comparable in absolute terms: the
 * figure-eight's home world sits in [0.377, 0.825] and the moth's in
 * [0.137, 0.170], a factor of two to five. A single absolute number would
 * mean "balmy" on one solution and "already dead" on the other.
 *
 * SCORCH_MULTIPLE is read against the top of that band, FREEZE_FRACTION
 * against the bottom.
 */
export const SCORCH_MULTIPLE = 2;
export const FREEZE_FRACTION = 0.55;
/**
 * How much simulation time beyond either threshold ends the civilisation.
 *
 * Exposure, not an instant. A civilisation dies of a scorching *period*: the
 * old model killed a world the frame it came within BURN_RADIUS of a sun,
 * which made a fast slingshot past a star indistinguishable from falling into
 * one. With a dwell, a close pass is survivable if it is quick — which is a
 * better thing to watch and a truer thing to claim.
 */
export const LETHAL_EXPOSURE = 1;
/**
 * How much of a lethal dose must have been delivered while all three suns were
 * bunched together for the death to be reported as a tri-solar day.
 *
 * A conjunction is not a separate way to die — it is an enormous flux reading,
 * so it already kills through heat. What it needs is to be *nameable*, and
 * naming it from the geometry at the instant of death did not work: the dose
 * takes LETHAL_EXPOSURE to deliver and the suns have usually dispersed by the
 * time it lands, so syzygy went from rare to never. Tracked as a share of the
 * dose instead, it names the thing that actually did the killing.
 */
export const SYZYGY_SHARE = 0.5;
/**
 * What makes heat a tri-solar day rather than a close pass: no single sun
 * supplying more than this share of the flux, so the world is being cooked by
 * the group.
 *
 * This replaces a geometric test — all three suns within SYZYGY_SPREAD of each
 * other and the world within SYZYGY_RANGE — which was measured to be
 * unreachable under an exposure model. Three suns bunched at the edge of that
 * range deliver a flux of about 1.04, and the figure-eight's scorch threshold
 * is 2.475, so the geometry that was called a tri-solar day could not actually
 * scorch anyone: over 75 simulated minutes the conjunction never once
 * coincided with lethal heat, and syzygy went from rare to impossible.
 *
 * Asking where the heat is coming from is both the better test and the more
 * literal one. A tri-solar day is three suns in the sky at once.
 */
export const SYZYGY_DOMINANCE = 0.6;

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
  return orbit.worlds[orbit.worlds.length - 1].r * ESCAPE_FACTOR;
}

/**
 * The frame the visitor is actually looking at, as a radius in world units.
 *
 * SystemCanvas sizes the view from the outermost world plus this margin, and
 * the harness calls the same function to decide whether a body is on screen.
 * It lives here, exported, because the simulation now has to know where the
 * picture ends: a Chaotic Era is over once the world it is about to be judged
 * on has left it, and there is no honest way to assert that against a number
 * three files each write down separately.
 *
 * It is a radius against a rectangle, so it is the conservative reading —
 * a body at this distance is off screen vertically and may still be visible to
 * the side.
 */
export const FRAME_MARGIN = 1.06;

export function frameRadiusFor(orbit: Orbit): number {
  return orbit.worlds[orbit.worlds.length - 1].r * FRAME_MARGIN;
}

/**
 * Beyond this a sun has escaped and the system has come apart. Without this
 * check the suns wander to hundreds of world units and leave the frame.
 */
export const SUN_ESCAPE_RADIUS = 6;
/**
 * The home world must hold this fraction of its own orbit, at every moment of
 * a Chaotic Era, for the civilisation to count as having survived.
 *
 * Both halves of that sentence are load-bearing.
 *
 * Every moment, because the test used to be read once, when the era's clock
 * ran out: a world could be thrown right across the system and happen to be
 * passing near its own radius at that instant. Measured over 75 simulated
 * minutes, a third of all survivals left the frame entirely — for as long as
 * 4.9s — and one passed within 0.002 of its own radius of the suns before
 * coming back. On screen that is a world leaving the system, so the notice
 * contradicted the animation it was describing.
 *
 * This fraction, because the band has to be wide enough to hold an undisturbed
 * orbit and narrow enough that staying inside it reads as staying put. These
 * orbits are ellipses: measured over eight pinned Stable Eras the
 * figure-eight's home world runs [0.784, 1.003] of its radius and the moth's
 * [0.948, 1.034], so nothing tighter than the wider of those can admit a world
 * that nothing has happened to. At [0.7, 1.3] the figure-eight's home world
 * may wander between 2.1 and 3.9 against a frame that reaches 4.45 — visibly
 * pushed about, never leaving. Both are asserted by the pinned rig, against
 * `homeExcursion`.
 *
 * It leaves the two solutions unequal, and deliberately so. The figure-eight
 * keeps 0.084 of room below its natural floor against the moth's 0.248, and
 * measured mortality is 95% against 51%. That looks like the band's doing and
 * is not: with the band effectively removed the split is 70% against 12%,
 * because the figure-eight holds its worlds from 3.0 outward while the suns
 * roam to 6, so they burn. Evening the tolerance out was measured and rejected
 * — every margin that helps the figure-eight lets its home world fall to about
 * 1.5 units on a frame reaching 4.45, which stops reading as an orbit held at
 * all. Bounding the absolute excursion is the thing worth keeping. See the
 * 2026-09-08 review.
 */
export const SURVIVABLE_BAND: readonly [number, number] = [0.7, 1.3];

/**
 * A sun further out than this when a civilisation falls is pulled back before
 * the settle begins. Set equal to SUN_ESCAPE_RADIUS, which is the furthest a
 * sun ever gets, so in practice nothing is ever moved and the glide always
 * starts from exactly where the sun was.
 */
export const SETTLE_START_RADIUS = SUN_ESCAPE_RADIUS;

/** Inside this of any sun, a planet is consumed. */
export const BURN_RADIUS = 0.22;

/**
 * How long Trisolaris must be unbound *and* outside its own orbit before the
 * simulation will say the planet is leaving.
 *
 * A dwell rather than an instant, for the same reason LETHAL_EXPOSURE is one:
 * a single frame of positive energy is what a slingshot looks like from the
 * inside, and a world can pick one up and be pulled back by the next sun it
 * passes. Measured over 150 simulated minutes, 28 Chaotic Eras touch positive
 * energy at some point and only 18 hold it for a full unit of simulation time.
 * The difference is the transients.
 */
export const UNBOUND_DWELL = 1;

export const SUN_COLORS = ["#e6a94c", "#7fb2ff", "#d4544a"] as const;
/** The home world. Deliberately the brightest, coolest thing on screen. */
export const HOME_COLOR = "#bcd3e8";
/** Every other world: dimmer and greyer, so Trisolaris reads first. */
export const WORLD_COLOR = "#6b7183";

/**
 * Periodic solutions for three equal masses, in the collinear parameterisation
 *   r1 = (-1,0), r2 = (1,0), r3 = (0,0);  v1 = v2 = (vx,vy);  v3 = -2(vx,vy)
 *
 * `worlds[0]` is Trisolaris. Nothing in this table is chosen for looks: a world
 * is kept only if its orbit stays bound across a run of Stable Eras, and the
 * gaps between the radii are the radii that did not. The figure-eight holds
 * worlds from 3.0 outward, the moth only from 4.6, which is why its system
 * looks so much wider.
 *
 * The provenance is `npm run sim:report`, which re-measures every world in
 * this table over eight pinned Stable Eras per solution and prints the worst
 * peak radius each one reaches. A new world is added by writing it here and
 * reading what the harness says; the comment cannot go stale because the
 * number is recomputed rather than recorded.
 *
 * Peak radius is the measure, not a symmetric band: these orbits are ellipses,
 * and the figure-eight's home world dips to 0.784 of its radius every era
 * while never exceeding 1.003 of it. A symmetric band rejects the shipping
 * site.
 *
 * Later worlds were interleaved between the original radii rather than added
 * beyond them. The frame is derived from the outermost radius (`outermost *
 * 1.06` in SystemCanvas) while `drawSun` uses a fixed pixel size, so extending
 * outward does not shrink the suns — it crowds them together. At a 1440-wide
 * hero an outermost 5.4 would take the figure-eight from 86 to 67 px/unit, and
 * the three coronas are 68px across and already overlapping at 86. The band
 * inward of 3.0 is the one measured not to survive, so the gaps are the only
 * room there is.
 *
 * The angle is written down per world rather than derived from the array
 * length. Stability depends on a world's phase relative to the suns — the same
 * reason `advance` re-seeds survivors onto canonical angles — so deriving it
 * from the length meant adding one world silently re-phased every sibling onto
 * an unmeasured initial condition.
 */
export type Orbit = {
  id: string;
  name: string;
  cjk: string;
  vx: number;
  vy: number;
  period: number;
  /** Radius and starting angle, in degrees, of each world. Innermost first. */
  worlds: { r: number; angle: number }[];
  /**
   * The fractions of `worlds[0].r` the home world runs between over an
   * undisturbed Stable Era — the orbit it is actually on, as opposed to the
   * radius it was placed at.
   *
   * Written down because three comments already cite these numbers as the
   * reason SURVIVABLE_BAND is not symmetric, and nothing checked them. The
   * pinned rig in `npm run sim:report` re-measures both ends and fails if the
   * table has drifted, and asserts the band still admits the whole range: an
   * orbit whose undisturbed motion fell outside the band could never be
   * survived, and nothing else would notice.
   *
   * They are not an input to the decision. A margin around each orbit's own
   * excursion was measured as a replacement for the fixed band and rejected —
   * see the 2026-09-08 review.
   */
  homeExcursion: readonly [number, number];
  /**
   * The flux the home world stands in over an undisturbed Stable Era — the
   * light this civilisation evolved under, and the band SCORCH_MULTIPLE and
   * FREEZE_FRACTION are read against. Measured and asserted by the pinned rig
   * in `npm run sim:report`, the same way `homeExcursion` is.
   */
  homeFlux: readonly [number, number];
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
    worlds: [
      { r: 3.0, angle: 0 },
      { r: 3.3, angle: 72 },
      { r: 3.6, angle: 144 },
      { r: 3.9, angle: 216 },
      { r: 4.2, angle: 288 },
    ],
    homeExcursion: [0.784, 1.003],
    homeFlux: [0.3773, 0.825],
    stableDuration: 16,
  },
  {
    id: "moth",
    name: "Moth",
    cjk: "飞蛾",
    vx: 0.46444,
    vy: 0.39606,
    period: 14.8939,
    worlds: [
      { r: 4.6, angle: 0 },
      { r: 5.05, angle: 90 },
      { r: 5.5, angle: 180 },
      { r: 6.0, angle: 270 },
    ],
    homeExcursion: [0.948, 1.034],
    homeFlux: [0.1373, 0.1701],
    stableDuration: 20,
  },
];

/**
 * How a *civilisation* ended. Not how a planet was destroyed — Trisolaris is
 * never destroyed here, any more than it is in the books, where eleven sibling
 * worlds were swallowed and the twelfth carried two hundred civilisations
 * through fire, ice and dehydration without ever being lost itself.
 *
 * `fire` and `cold` used to live in this list and were the deaths of the
 * eleven, wrongly attached to the one. They are now what `isDestroyed` tests
 * for the outer worlds, and they never end a civilisation.
 *
 * `starless` is gone entirely rather than reworded. It fired when any sun
 * passed radius 6 from the centre, which measures nothing about the world: at
 * the moment it triggered, the home world's median flux was 0.160, inside the
 * moth's ordinary Stable Era band of [0.137, 0.170]. It ended civilisations
 * that were standing in perfectly good light, and it ended every world at once
 * wherever any of them happened to be. Flux is the thing it was failing to
 * measure.
 */
export type CollapseCause = "scorched" | "frozen" | "syzygy" | "drift";

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
  /**
   * True for a world that arrived with this civilisation, so the renderer
   * fades it in rather than popping it into place. False for one that was
   * already here.
   *
   * Per world, because the settle is not the same event for all of them. A
   * collapse builds new outer worlds while the old ones fade out as ghosts —
   * that cross-fade is the point — but it carries Trisolaris across, and a
   * survival replaces nothing at all. Fading the whole system in over every
   * settle took the carried home world and every survivor to alpha 0 on the
   * frame the notice landed, which made the trails this simulation is careful
   * to preserve invisible for the five seconds they most needed to be seen.
   *
   * Cleared when the settle adopts the shadow, whose worlds are built by
   * `planetsFor` and are not fading in — so a world fades in once, for the
   * arrival it belongs to, and never again.
   */
  fadesIn: boolean;
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
   * Set the first moment this era's chaos throws the home world outside
   * SURVIVABLE_BAND, and cleared when a new era begins. Once set the
   * civilisation cannot survive the era: its orbit is gone, whatever the world
   * happens to be doing when the clock runs out.
   */
  orbitWrecked: boolean;
  /**
   * Simulation time this civilisation has spent beyond either flux threshold,
   * reset when a new Chaotic Era begins. Either reaching LETHAL_EXPOSURE ends
   * it. Accumulated rather than latched on a single frame, so a fast pass
   * close to a sun is survivable and a long one is not.
   */
  heatExposure: number;
  coldExposure: number;
  /**
   * Simulation time Trisolaris has spent unbound *and* outside its own orbit,
   * reset when a new Chaotic Era begins. Past UNBOUND_DWELL the planet is
   * leaving, and `advance` says so once.
   */
  unboundFor: number;
  /**
   * The planet is gone and there will be no more civilisations. The suns keep
   * running and the world keeps coasting on the trajectory that took it away;
   * nothing resolves, nothing collapses, and heat falls to nothing.
   *
   * Set by the page, which owns the counter that decides whether losing
   * Trisolaris is the end or a catastrophe lived through. Held here rather
   * than out there because the alternative was for the page to stop calling
   * `advance` — which freezes the suns mid-chaos and pins `heat` at its
   * Chaotic Era value for good, leaving the site red and stopped under a line
   * that says the three suns go on without it.
   */
  departed: boolean;
  /** How much of the heat above was taken with all three suns in conjunction. */
  syzygyDose: number;
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
   * The home world came through a Chaotic Era. Measured, 25% of them end this
   * way, and without an event for it the outcome was reported by nothing —
   * indistinguishable on screen from a death whose notice had failed.
   */
  | { type: "survived"; civilization: number }
  | { type: "worldLost"; remaining: number }
  /**
   * Trisolaris itself is no longer bound to the three suns: positive specific
   * orbital energy, outside its own orbit, for long enough that it is leaving
   * rather than being flung about. The planet is lost, not a civilisation.
   *
   * The simulation reports it and decides nothing. Whether this is the end of
   * the world or a catastrophe survived depends on how many civilisations have
   * come and gone, and that count lives in `localStorage` where the page keeps
   * it — so the gate is the page's, and this event fires either way.
   *
   * Chosen over a collision because a collision does not happen. Measured over
   * 150 simulated minutes and 338 Chaotic Eras, the home world never came
   * within the radius of the disc it is drawn as; the closest approach ever
   * seen was 0.0326 against a drawn core of 0.024. Letting a doomed era play
   * out past its exposure death does produce hits — 3 of 308 eras get inside
   * the core — which says the trajectory exists and the scorching always gets
   * there first. Making it fire would mean exempting a falling world from the
   * death that #17 established, so it is not a trigger, it is a near miss.
   */
  | { type: "lost"; civilization: number };

function sunsFor(orbit: Orbit): Body[] {
  return [
    { x: -1, y: 0, vx: orbit.vx, vy: orbit.vy, ax: 0, ay: 0 },
    { x: 1, y: 0, vx: orbit.vx, vy: orbit.vy, ax: 0, ay: 0 },
    { x: 0, y: 0, vx: -2 * orbit.vx, vy: -2 * orbit.vy, ax: 0, ay: 0 },
  ];
}

function planetsFor(orbit: Orbit): Planet[] {
  // The angles are spread so the worlds don't line up like a diagram, but they
  // come from the table rather than from the index: each one is a measured
  // initial condition, not a share of the circle.
  return orbit.worlds.map(({ r: home, angle: degrees }, i) => {
    const angle = (degrees * Math.PI) / 180;
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
      fadesIn: false,
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

  const home = orbit.worlds[0].r;
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
    orbitWrecked: false,
    heatExposure: 0,
    coldExposure: 0,
    unboundFor: 0,
    departed: false,
    syzygyDose: 0,
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

/**
 * How much of the remaining gap to the shadow to close this frame.
 *
 * The settle used to close a fixed fraction per frame — a first-order lag with
 * a time constant of SETTLE_TIME/4. Chasing a *moving* target, that never
 * arrives: it settles at a steady-state lag of roughly v x tau behind, and the
 * home world orbits at v = sqrt(3/r) ~ 1.0 against tau = 1.25, so it ended
 * every settle about 1.25 units short. The code then assigned the shadow
 * outright, which is what that distance became: a teleport, on all 166 settles
 * of a 75-minute run, up to 1.286 units for a world and 1.015 for a sun.
 *
 * Lengthening SETTLE_TIME cannot fix that. The lag is proportional to the time
 * constant, so a longer settle is a *larger* jump, held for longer.
 *
 * So the gap is given an envelope that reaches zero when the settle does:
 *
 *   gap(s) = exp(-4s) * (1 - smoothstep(s))
 *
 * The first factor is exactly the old behaviour — exp(-4s) in settle-fraction
 * units is the same curve as a time constant of SETTLE_TIME/4 — and the second
 * is 1 at the start and 0 at the end, with zero slope at both. So the early
 * settle moves exactly as it always did, and the arrival is forced rather than
 * approached. The adoption at the end is then a no-op instead of a cut, and it
 * is kept precisely because it should be one: the era still begins from the
 * validated initial conditions, now by convergence rather than by assignment.
 *
 * The weight is the *ratio* of consecutive envelope values rather than the
 * envelope itself, because it multiplies a gap that has already been closed by
 * every previous frame.
 *
 * Two things this must not do, both measured in the 2026-09-09 review:
 *
 *   - Freeze. The real bodies do not integrate during a settle; every bit of
 *     their motion is this weight times the gap. A weight easing in from zero
 *     stalls them visibly at the moment the era ends. The exponential factor
 *     is what keeps the opening frames moving at the rate they always did.
 *   - Straighten. The point of chasing an orbiting shadow is that bodies curve
 *     home rather than sliding there. Measured as path length over chord, the
 *     settle runs 1.37 for the home world and 1.91 for a sun; the envelope
 *     leaves both alone because it only scales how fast the gap closes.
 */
function blendWeight(before: number, after: number): number {
  const envelope = (s: number) => Math.exp(-4 * s) * (1 - s * s * (3 - 2 * s));
  // No guard on the divisor. The only caller is inside `sys.settle < 1`, and
  // `envelope(s) > 0` for every s below 1: `settle` is written only by
  // `beginSettle` and the clamped increment, so `before` is a multiple of
  // SIM_FRAME_TIME/SETTLE_TIME and the smallest value it can reach here is
  // envelope(284h) = 5.6e-9. The frame that would divide by zero is the one
  // with after = 1, which returns 1 through this same expression.
  return 1 - envelope(after) / envelope(before);
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
 * How much to shrink the step this frame. Driven by the fastest sun, since
 * speed is what both breaks the integrator and outruns the display.
 *
 * Suns only, deliberately. The worlds are test particles: they take no part in
 * the suns' periodic solution, and letting them into this maximum put them
 * back into it by the side door, because the resulting scale is applied to the
 * whole system. Measured, adding two decorative worlds was enough to make the
 * suns diverge from the same seed after 21 seconds — so world count was not
 * the display-only decision this file claims it is. Dropping the planets costs
 * almost nothing: sampled per frame, a planet set the scale in 464 frames out
 * of 270,000 and the worst it ever drove was 0.76. It buys back sun paths that
 * are identical whatever is orbiting them.
 */
function timeScaleFor(sys: System): number {
  let fastest = 0;
  for (const s of sys.suns) fastest = Math.max(fastest, Math.hypot(s.vx, s.vy));
  if (fastest <= SPEED_REFERENCE) return 1;
  return Math.max(MIN_TIME_SCALE, SPEED_REFERENCE / fastest);
}

/**
 * The light this world is standing in: the sum of inverse-square flux from all
 * three suns, in units where each sun radiates 1.
 *
 * This is what a Chaotic Era actually does to a civilisation. Distance to the
 * nearest sun cannot express it — a world can be far from one sun and cooked
 * by the other two, or close to one and freezing because it is the only one
 * left in reach. Softened by the same PLANET_SOFTENING the force law uses, so
 * a near miss is a very large number rather than an infinite one.
 */
export function fluxOn(planet: Point, suns: Body[]): number {
  let total = 0;
  for (const sun of suns) {
    const dx = sun.x - planet.x;
    const dy = sun.y - planet.y;
    total += 1 / (dx * dx + dy * dy + PLANET_SOFTENING * PLANET_SOFTENING);
  }
  return total;
}

/**
 * Specific orbital energy of a world against the three suns — kinetic per unit
 * mass, plus the potential of all three.
 *
 * Negative is bound: whatever chaos is doing to it, the world is still on some
 * orbit of this system and will come back. Positive is not, and that is the
 * only honest way to say a planet has been *lost* rather than thrown about.
 * Distance cannot say it — the home world routinely reaches twice its own
 * radius and returns, which is most of what a Chaotic Era looks like.
 *
 * Softened to match `computePlanetAcceleration` exactly — the potential whose
 * gradient is that force law, `-1/sqrt(d^2 + PLANET_SOFTENING)`, and not a
 * floor on `d`. The two are not interchangeable: clamping the distance instead
 * gave -5.77 at d = 0.1 where the integrator is working in a well of -10.0, so
 * the energy was not conserved along the trajectory it was measuring and close
 * passes read as more bound than they are. It moves the trigger barely at all,
 * since a departure is judged far from the suns where the two agree, but an
 * energy that disagrees with its own force law is not a measurement.
 *
 * Note that PLANET_SOFTENING means two different things in this file: the force
 * law adds it to d^2 un-squared, giving a softening length of sqrt(0.02), while
 * `fluxOn` squares it first. That disagreement is older than this function and
 * is left alone deliberately — flux feeds the exposure thresholds that #17 swept
 * to choose SCORCH_MULTIPLE and FREEZE_FRACTION, and changing what it means
 * would move every one of those numbers for no gain here.
 */
export function specificEnergy(planet: Body, suns: Body[]): number {
  let potential = 0;
  for (const sun of suns) {
    const dx = sun.x - planet.x;
    const dy = sun.y - planet.y;
    potential -= G / Math.sqrt(dx * dx + dy * dy + PLANET_SOFTENING);
  }
  return (planet.vx * planet.vx + planet.vy * planet.vy) / 2 + potential;
}

/**
 * Whether this world has been physically destroyed: swallowed by a sun, or
 * thrown clear of the system into the dark.
 *
 * This is what happened to the eleven siblings, and it is the only thing that
 * happens to the outer worlds here. It is deliberately not applied to
 * Trisolaris. A civilisation on it dies of what the sky does to it — see
 * `civilisationFates` — while the world itself goes on, which is the whole
 * arrangement the books describe.
 *
 * BURN_RADIUS is a near miss rather than a collision because the suns have no
 * radius in the *physics* — they are point masses softened by SUN_SOFTENING.
 * That is knowingly not true of the canvas, and the gap is worth stating rather
 * than leaving as a claim a reader can measure and find false: SystemCanvas
 * draws a sun as a 4.4px core inside a 34px corona, and measured over the
 * report seeds the home world passes within 0.0098 world units of a sun's
 * centre — 0.6px at a 1600x900 hero — and spends 148 frames inside BURN_RADIUS.
 * Trisolaris is drawn inside the disc of a star and comes out alive.
 *
 * Accepted, on two grounds. Surviving a fast close pass is the intended
 * behaviour and the reason exposure replaced a radius test at all — a floor
 * loose enough to catch this pass is BURN_RADIUS again, which is the model this
 * one replaced. And any floor tight enough to mean "inside the drawn disc" is a
 * pixel radius that moves with the hero's size: 0.051 world units on the
 * figure-eight against 0.068 on the moth at 1600x900, and different again at
 * every other width, so it cannot be written down here honestly. What the
 * canvas does have is additive blending, and the sun is drawn over the worlds:
 * inside the corona the world is swamped rather than drawn on top of a star, so
 * what is on screen is a world going in and coming out. See the 2026-09-09
 * findings review.
 */
function isDestroyed(planet: Planet, sys: System): boolean {
  const nearest = Math.min(
    ...sys.suns.map((s) => Math.hypot(s.x - planet.x, s.y - planet.y)),
  );
  if (nearest < BURN_RADIUS) return true;
  return Math.hypot(planet.x, planet.y) > escapeRadiusFor(sys.orbit);
}

/**
 * Every way this civilisation is currently dying, from accumulated exposure
 * rather than from where the world is standing this instant.
 *
 * Both can hold at once — an era that froze a civilisation half to death and
 * then threw it past a sun is honestly described either way, and pickFate has
 * two true things to choose between rather than repeating itself.
 */
function civilisationFates(sys: System): CollapseCause[] {
  const fates: CollapseCause[] = [];
  if (sys.heatExposure >= LETHAL_EXPOSURE) fates.push("scorched");
  if (sys.coldExposure >= LETHAL_EXPOSURE) fates.push("frozen");
  return fates;
}

/**
 * Every way of describing a death that holds, including ones that are true but
 * not themselves lethal. A world dies of fire or cold; that its orbit was also
 * long past saving is equally true, and gives pickFate an honest alternative
 * to reach for rather than repeating the previous cause.
 *
 * Drift comes from the flag rather than from the world's radius at this
 * instant, because an orbit is wrecked for the rest of the era from the moment
 * it goes: a world swinging back through its own radius on its way somewhere
 * else is not on that orbit any more, and reading only the instant let it deny
 * on the way past what it had already done.
 */
function describeFates(sys: System, lethal: CollapseCause[]): CollapseCause[] {
  // A tri-solar day is a description of *how* the sky killed you, not a
  // separate way of dying: three suns bunched with the world close by is an
  // enormous flux reading, so it already registers as heat. Naming it when the
  // geometry actually holds keeps the most famous disaster in the books
  // reportable without it being a second lethal path nobody could audit.
  //
  // It goes *first*, ahead of the exposure that did the killing, because it is
  // strictly the more specific truth: "scorched" and "all three suns rose at
  // once" describe the same death, and only one of them says which. Appended
  // last it was unreachable — pickFate takes the first fate that is not a
  // repeat, and the lethal cause is always in front of it.
  //
  // Only over a death by heat. syzygyDose only accumulates inside the heat
  // branch, so it is a share of the *heat* dose — and applied to whatever
  // `lethal` happened to hold it renamed deaths that were not heat deaths
  // at all: cook the world under a conjunction to half a dose, then fling it
  // out until the cold finishes it, and the notice said all three suns rose at
  // once about a civilisation that froze. Measured, 1 of 14 syzygy notices, and
  // the same path let a timeout be reported as a tri-solar day on sub-lethal heat.
  const conjunction =
    lethal.includes("scorched") && sys.syzygyDose >= LETHAL_EXPOSURE * SYZYGY_SHARE;
  const fates: CollapseCause[] = conjunction ? ["syzygy", ...lethal] : [...lethal];
  if (sys.orbitWrecked) fates.push("drift");
  return fates;
}

/** True while the home world is still on something like its own orbit. */
function holdsItsOrbit(planet: Planet): boolean {
  const radius = Math.hypot(planet.x, planet.y);
  return (
    radius >= planet.home * SURVIVABLE_BAND[0] && radius <= planet.home * SURVIVABLE_BAND[1]
  );
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
    // Down to the limit, for the same reason the sun trails are: one point a
    // frame never drains a trail that arrived over the new orbit's limit.
    if (p.trail.length > sys.planetTrailLength) {
      p.trail.splice(0, p.trail.length - sys.planetTrailLength);
    }
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
  // Trisolaris itself, carried across rather than retired. See below.
  const survivingHome = { ...sys.planets[0] };

  // Everything still standing fades out rather than disappearing, and the sun
  // trails carry over — clearing them made the figure-eight blink out of
  // existence on every collapse.
  //
  // The home world is the exception, and it is the point of the whole model:
  // a civilisation ended, not a planet. Ghosting Trisolaris here made every
  // notice a lie — the text said the people were gone while the animation
  // faded out the world underneath them, and then produced a fresh one.
  const ghosts = [
    ...sys.ghosts,
    ...sys.planets
      .filter((pl) => pl.alive && !pl.isHome)
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

  // Trisolaris resumes from exactly where the last civilisation left it, and
  // the settle carries it into its place in the new configuration — the same
  // blend that already brings survivors back onto canonical angles. So the
  // world is visibly the same world: it is thrown into a new orbit as the suns
  // re-form around it, rather than dying and being replaced by a copy.
  //
  // Its trail comes too. That trail is the only unbroken thing on screen
  // across a collapse, and it is what makes the continuity legible instead of
  // merely true.
  Object.assign(sys.planets[0], {
    x: survivingHome.x,
    y: survivingHome.y,
    vx: survivingHome.vx,
    vy: survivingHome.vy,
    ax: survivingHome.ax,
    ay: survivingHome.ay,
    // Down to the new orbit's limit, not merely copied. A collapse switches
    // solution, and moth -> figure-eight drops planetTrailLength from 691 to
    // 364 — a difference recordTrails can never drain, because push-then-shift
    // -one nets zero. Measured, the home world carried a trail 90% over its
    // limit for 31% of a 75-minute run. It is the same failure the sun trails
    // are truncated for above; the home world got the copy and not the cut.
    trail: survivingHome.trail.slice(-sys.planetTrailLength),
  });
  // The new outer worlds fade in against the ghosts of the ones they replace.
  // Trisolaris does not: it was carried across, it is already on screen, and
  // fading it out and back in is the cut this whole arrangement exists to
  // avoid — on the one body the design says the eye is tracking.
  sys.planets.forEach((p, i) => {
    p.fadesIn = i > 0;
  });
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
      const settleBefore = sys.settle;
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

      const w = blendWeight(settleBefore, sys.settle);
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

      // Charged in simulation time, not frames: the step shrinks during a
      // close encounter, so counting frames would bill a slingshot past a sun
      // for several times the heat it actually delivered. Only during a
      // Chaotic Era — a Stable Era is, by construction, inside the band.
      if (sys.era === "chaotic") {
        const home = sys.planets[0];
        const [coolest, warmest] = sys.orbit.homeFlux;
        const flux = fluxOn(home, sys.suns);
        if (flux > warmest * SCORCH_MULTIPLE) {
          sys.heatExposure += advanced;
          // Where is it coming from? If no one sun dominates, three of them
          // are in the sky at once and this is the tri-solar day.
          let strongest = 0;
          for (const sun of sys.suns) {
            const dx = sun.x - home.x;
            const dy = sun.y - home.y;
            strongest = Math.max(strongest, 1 / (dx * dx + dy * dy + PLANET_SOFTENING ** 2));
          }
          if (strongest / flux < SYZYGY_DOMINANCE) sys.syzygyDose += advanced;
        } else if (flux < coolest * FREEZE_FRACTION) {
          sys.coldExposure += advanced;
        }

        // Is the planet itself leaving? Energy rather than distance, and
        // outside its own orbit as well, so that a world picking up speed on
        // its way *through* the system cannot read as one departing it.
        //
        // This ends nothing here. The era resolves by exposure and by the band
        // exactly as it always has, and the page decides what the event means:
        // below the counter's threshold a civilisation lives through the worst
        // thing that has ever happened to it, and above it, the fleet leaves.
        const leaving =
          specificEnergy(home, sys.suns) > 0 &&
          Math.hypot(home.x, home.y) > home.home;
        if (leaving) {
          const before = sys.unboundFor;
          sys.unboundFor += advanced;
          if (before < UNBOUND_DWELL && sys.unboundFor >= UNBOUND_DWELL) {
            events.push({ type: "lost", civilization: sys.civilization });
          }
        } else {
          sys.unboundFor = 0;
        }
      }
    }

    if (settling) {
      sys.eraElapsed += SIM_FRAME_TIME;
      sys.timeScale = 1;
    }

    decayGhosts(sys, SIM_FRAME_TIME);

    // Heat trails the era rather than tracking it, and cools far more slowly
    // than it builds, so the page fades back to black instead of cutting.
    // A departed system cools whatever era it was in when it ended: there is
    // nobody left for it to be a Chaotic Era for.
    const target = sys.era === "chaotic" && !sys.departed ? 1 : 0;
    const tau = target > sys.heat ? HEAT_RISE : HEAT_FALL;
    sys.heat += (target - sys.heat) * (1 - Math.exp(-SIM_FRAME_TIME / tau));

    // Everything above still runs when the planet has gone: the suns are
    // integrated, trails are recorded, ghosts fade and heat falls away.
    // Everything below decides the fate of a civilisation, and there is not
    // one to decide.
    if (sys.departed) continue;

    // Worlds are only at risk once the suns are actually moving freely.
    if (!settling) {
      const home = sys.planets[0];

      // Read every frame rather than once at the end of the era, so that
      // whether the civilisation survives is decided by the whole of what the
      // visitor watched happen to its world.
      if (sys.era === "chaotic" && !holdsItsOrbit(home)) sys.orbitWrecked = true;

      const homeFates = civilisationFates(sys);
      if (homeFates.length > 0) {
        const cause = pickFate(describeFates(sys, homeFates), sys.lastCause);
        const destroyed = sys.civilization;
        events.push({ type: "collapse", civilization: destroyed, cause });
        resetInto(sys, destroyed + 1, cause);
        events.push({ type: "era", era: "stable" });
        continue;
      }

      for (let i = 1; i < sys.planets.length; i++) {
        const world = sys.planets[i];
        if (!world.alive) continue;
        if (isDestroyed(world, sys)) {
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
        sys.orbitWrecked = false;
        sys.heatExposure = 0;
        sys.coldExposure = 0;
        sys.unboundFor = 0;
        sys.syzygyDose = 0;
        events.push({ type: "era", era: "chaotic" });
      }
      continue;
    }

    // Chaotic Era: it breaks when the clock runs out, or the moment the suns
    // themselves come apart.
    //
    // The second half of that used to be `starless`, which killed the
    // civilisation outright when a sun passed SUN_ESCAPE_RADIUS. That was
    // wrong about the people — measured, the home world's flux at the moment
    // it fired was 0.160, squarely inside the moth's ordinary Stable Era band
    // — but it was doing a second job nobody had written down: it was the only
    // thing that ever brought a wandering sun back. Deleting it as a cause and
    // not replacing it as a *terminator* let the suns drift past 6 and off the
    // frame, and took two unrelated invariants red.
    //
    // So the era ends here and the system re-forms, while what became of the
    // civilisation is still decided by exposure and by its orbit. If neither
    // condemns it, a sun wandering off is something it lives through.
    const sunsComeApart = sys.suns.some(
      (s) => Math.hypot(s.x, s.y) > SUN_ESCAPE_RADIUS,
    );

    // It ends the era and it decides nothing about the people. Condemning them
    // as well — `if (sunsComeApart) sys.orbitWrecked = true` — made the
    // survival branch unreachable on this path by construction: measured, 5 of
    // 5 such eras collapsed and none survived, and two of those five were shown
    // "the orbit never recovered" while sitting at 1.05 and 1.07 of their own
    // radius with no exposure worth the name. That is the same lie `starless`
    // was deleted for, relabelled. A civilisation's fate is what the sky did to
    // it and whether it held its orbit; a sun wandering off is something it
    // lives through.
    //
    // What justified condemning them was that a survival notice must not land
    // over a frame with a sun missing from it. That still holds — it is
    // asserted by the harness rather than bought here, and SUN_ESCAPE_RADIUS is
    // inside the frame on the moth and outside it on the figure-eight. See the
    // 2026-09-09 review.
    const home = sys.planets[0];
    // The home world has left the picture, so the era it is being judged on is
    // no longer on screen. This does not condemn it either: the frame edge lies
    // outside SURVIVABLE_BAND on both solutions — asserted, because that is
    // what makes this a matter of *when* the notice lands rather than whether
    // the civilisation dies — so `orbitWrecked` is already set by the time this
    // can hold. What it removes is the gap: killing the world on accumulated
    // cold instead of instantly at escapeRadiusFor let it drift off screen for
    // up to LETHAL_EXPOSURE of sim time before its notice arrived, worst
    // measured 3.52s, and let it reach 6.44 — past the moth's own frame.
    const homeLeftFrame = Math.hypot(home.x, home.y) > frameRadiusFor(sys.orbit);

    if (sys.eraElapsed >= CHAOS_MAX || sunsComeApart || homeLeftFrame) {
      // Surviving means the orbit was never lost — not that the world happens
      // to be crossing its own radius now. A world flung onto a wild ellipse
      // hasn't survived in any meaningful sense; it just hasn't finished
      // dying, and letting one through on the strength of where it was at the
      // final frame is how a civilisation came to be congratulated for an era
      // it spent off screen.
      if (sys.orbitWrecked) {
        // Whatever else is true of the world right now counts too, so a run of
        // timeouts doesn't report "drift" over and over.
        const cause = pickFate(describeFates(sys, []), sys.lastCause);
        const destroyed = sys.civilization;
        events.push({ type: "collapse", civilization: destroyed, cause });
        resetInto(sys, destroyed + 1, cause);
        events.push({ type: "era", era: "stable" });
        continue;
      }

      // The civilisation survived. Ease back onto the periodic solution from
      // wherever chaos left the worlds, exactly as a collapse already does.
      //
      // This used to place them on their canonical starting angles first,
      // because stability depends on a world's phase relative to the suns and
      // an arbitrary angle is an unvalidated initial condition — measured,
      // those wander far enough to be destroyed during the following Stable
      // Era, which is not survival in any useful sense. That reasoning is
      // still right; the assignment was the wrong way to act on it.
      //
      // `beginSettle` builds its shadow from `planetsFor(sys.orbit)` on the
      // very next line, and now that the blend arrives rather than merely
      // approaching — see `blendWeight` — the worlds *converge* onto it
      // instead of being placed on it.
      //
      // Not onto the canonical starting angles, though: the shadow integrates
      // every settling frame, so what they arrive at is the periodic solution
      // advanced by SETTLE_TIME. That is the validated state either way —
      // every phase of a periodic solution is on it — and it is exactly what
      // the old code adopted at the end of the settle too, which is why the
      // destination is identical and nothing downstream moved. What changed is
      // that they travel there. Placed instead, a world crossed up to 11.531 world
      // units between two frames, further than the width of the frame it is
      // drawn in, on all 42 survivals of a 75-minute run.
      //
      // Their trails come with them, as Trisolaris' does across a collapse.
      // Clearing them was the other half of the same cut: 168 trails, every
      // surviving world, wiped in the frame the notice landed in. The trail
      // could only be kept once the path became continuous — carried across
      // the teleport it drew a chord straight over the frame.
      beginSettle(sys);
      events.push({ type: "survived", civilization: sys.civilization });
      events.push({ type: "era", era: "stable" });
    }
  }

  return events;
}
