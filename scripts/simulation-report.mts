/**
 * Regression harness for the Trisolaran simulation.
 *
 * Every number quoted in docs/reviews came from this script. It exists because
 * the simulation cannot be checked by looking at it: a browser preview shows a
 * few seconds of one era, while the failures that actually matter — a world
 * dying during a Stable Era, a sun leaving the frame, a cause repeating
 * forever — only show up over tens of minutes of simulated time.
 *
 *   npm run sim:report          print the report
 *   npm run sim:report -- --json    machine-readable, for diffing runs
 *
 * Exits non-zero if any invariant fails, so it can gate a commit.
 */
import {
  advance,
  createSystem,
  ORBITS,
  PERTURB_RAMP,
  SIM_FRAME_TIME,
  SIM_HZ,
  SUN_ESCAPE_RADIUS,
  SURVIVABLE_BAND,
  CIVILIZATIONS_PER_HOUR,
  LETHAL_EXPOSURE,
  SYZYGY_SHARE,
  fluxOn,
  frameRadiusFor,
  type CollapseCause,
  type Planet,
  type SimEvent,
  type System,
} from "../src/lib/trisolaris.ts";

const SEEDS = [99, 7, 2024, 5, 31415];
const MINUTES_PER_SEED = 15;

/** Deterministic PRNG, so a run is reproducible and diffable. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, places = 3) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const toSeconds = (simTime: number) => round(simTime / (SIM_HZ * SIM_FRAME_TIME), 2);

type Check = { name: string; value: string; expected: string; pass: boolean };
const checks: Check[] = [];
const record = (name: string, value: string | number, expected: string, pass: boolean) =>
  checks.push({ name, value: String(value), expected, pass });

/* --------------------------------------------------------------------------
   1. Each periodic solution must actually close on itself.
   -------------------------------------------------------------------------- */
const closure: Record<string, number> = {};
for (let ci = 1; ci <= ORBITS.length; ci++) {
  const orbit = ORBITS[ci - 1];
  // Whole periods that fit inside a Stable Era, so the measurement never runs
  // past the perturbation and reports chaos as drift.
  const periods = Math.max(1, Math.floor((orbit.stableDuration * 0.92) / orbit.period));
  const sys = createSystem(ci);
  const start = sys.suns.map((s) => ({ x: s.x, y: s.y }));
  for (let f = 0; f < Math.round((orbit.period * periods) / SIM_FRAME_TIME); f++) {
    advance(sys, 1, () => 0.5);
  }
  const drift = Math.max(
    ...sys.suns.map((s, i) => Math.hypot(s.x - start[i].x, s.y - start[i].y)),
  );
  closure[orbit.id] = drift;
  record(`closure drift: ${orbit.id} over ${periods}T`, round(drift), "< 0.06", drift < 0.06);
}

/* --------------------------------------------------------------------------
   2. Entering a Chaotic Era must not put a kink in the orbits.
   -------------------------------------------------------------------------- */
{
  const angleBetween = (a: { vx: number; vy: number }, b: { vx: number; vy: number }) => {
    const denom = Math.hypot(a.vx, a.vy) * Math.hypot(b.vx, b.vy) || 1;
    const dot = (a.vx * b.vx + a.vy * b.vy) / denom;
    return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  };
  const stable: number[] = [];
  const ramp: number[] = [];

  for (const seed of [3, 4, 5, 6, 7, 8]) {
    const sys = createSystem();
    const rand = mulberry32(seed);
    const prev = sys.suns.map((s) => ({ vx: s.vx, vy: s.vy }));
    let chaosAt = -1;
    let t = 0;
    for (let f = 0; f < 50 * SIM_HZ; f++) {
      const events = advance(sys, 1, rand);
      t += SIM_FRAME_TIME;
      const inRamp = chaosAt >= 0 && t - chaosAt <= PERTURB_RAMP;
      sys.suns.forEach((s, i) => {
        const turned = angleBetween(prev[i], s);
        prev[i] = { vx: s.vx, vy: s.vy };
        if (chaosAt < 0) stable.push(turned);
        else if (inRamp) ramp.push(turned);
      });
      if (events.some((e) => e.type === "era" && e.era === "chaotic")) chaosAt = t;
      if (chaosAt >= 0 && t - chaosAt > PERTURB_RAMP + 1) break;
    }
  }
  const median = (v: number[]) => {
    const sorted = [...v].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const stableMedian = median(stable);
  const rampMedian = median(ramp);
  // The kick should be invisible frame to frame: no worse than a Stable Era.
  const ratio = rampMedian / stableMedian;
  record(
    "kick smoothness (median turn vs stable)",
    `${round(rampMedian, 2)} deg vs ${round(stableMedian, 2)} deg`,
    "ratio < 1.6",
    ratio < 1.6,
  );
}

/* --------------------------------------------------------------------------
   3. The long run: everything that only shows up over many eras.
   -------------------------------------------------------------------------- */
let chaoticEras = 0;
let collapses = 0;
let repeats = 0;
let deathsDuringStable = 0;
let collapsesWithoutSettle = 0;
let outerWorldsLost = 0;
let deaths = 0;
let survivals = 0;
let unfinishedChaos = 0;
let deathsWithoutGhost = 0;
let shortestTrailAfterCollapse = Infinity;
let maxTrailExcess = 0;
let maxPlanetTrailExcess = 0;
let maxSunRadius = 0;
let maxWorldWhileStable = 0;
let peakSunSpeed = 0;
let slowestRate = 1;
let worstCrossing = Infinity;
const noticeDelays: number[] = [];
const causeCounts: Partial<Record<CollapseCause, number>> = {};
// How many collapses reported a cause the state did not justify. Every
// collapse, not only the scorched and frozen ones: auditing those two covered
// 79 of 126, and because `describeFates` puts `syzygy` in *front* of the lethal
// cause, mislabelling a death as a tri-solar day was enough to lift it out of
// the audited set. An invariant a mislabel can escape by being mislabelled is
// not holding the line.
let deathsWithoutExposure = 0;
// Collapses that retired Trisolaris along with its civilisation.
let homeGhosted = 0;
// The worst either exposure reached in a Chaotic Era that was survived, as a
// fraction of the lethal dose — how close the survivors came.
let survivorWorstDose = 0;
// The worst any survivor did, over every Chaotic Era that was survived. A
// survival is a claim about the animation as much as about the state: the
// notice says the world came through, so the world has to have been visibly
// there to come through. See SURVIVABLE_BAND.
let survivorWorstHome = 0;
let survivorWorstSun = 0;
let survivorFramesOffScreen = 0;
// The furthest the home world got from the centre during a Chaotic Era, as a
// fraction of the frame. Nothing bounded it: the suns have SUN_ESCAPE_RADIUS
// and survivors have SURVIVABLE_BAND, but the home world of a civilisation
// about to die had neither, and reached 6.44 — past the moth's own frame of
// 6.36 — with the notice arriving later still.
let maxHomeInFrame = 0;
/**
 * The furthest any body moves between two frames, and what the frame was
 * doing when it did.
 *
 * The simulation is watched, so a discontinuity is a defect whatever the state
 * afterwards says. Nothing measured this, and two teleports had been shipping
 * since the shadow settle was written: the settle ends by adopting the shadow
 * outright, and the survival path places its worlds on their canonical angles.
 * Both are invisible to every other invariant here, because both land the
 * bodies on *correct* states — they are only wrong on the way there.
 *
 * Only bodies whose identity survives the frame are compared. The three suns
 * always qualify. `planets[0]` does too: Trisolaris is carried across a
 * collapse by `resetInto` rather than replaced. The outer worlds are replaced
 * on a collapse, so their apparent jump is a new world appearing — that is the
 * fade `worldAlpha` exists for, not a cut — and they are skipped on exactly
 * those frames.
 *
 * The bound is set from both sides, because a limit close to either one is
 * brittle. Ordinary play runs a median of 0.021 and a worst frame of 0.066.
 * The settle is livelier — worst 0.162, an outer world crossing the distance
 * it used to be teleported over — and the teleports it replaced were 1.015,
 * 1.141, 1.286, 3.931 and 11.531. So 0.3 sits 1.85x above the worst thing the
 * simulation legitimately does and 3.4x below the smallest cut ever measured.
 *
 * The blend is what the worst legitimate frame belongs to, not a close pass:
 * planets are deliberately left out of `timeScaleFor`, so the step does not
 * shrink for a world rounding a sun, and even that peaks at 0.127.
 */
const STEP_LIMIT = 0.3;
let worstStep = 0;
let worstStepWhat = "nothing moved";
/**
 * Trails wiped out from under a world that is still alive.
 *
 * The other half of the same cut: the survival path cleared every surviving
 * world's trail in the frame the notice landed in — 168 of them over a
 * 75-minute run — so the one continuous thing on screen vanished at the moment
 * the visitor was being told the civilisation had come through. A trail only
 * ends legitimately when its world does, or when a collapse replaces an outer
 * world with a new one.
 */
let trailsWiped = 0;
let worstTrailShrink = 0;
/**
 * The worst frame-to-frame *change* in a body's step, and where it happened.
 *
 * `worstStep` is a C0 bound: it says no body jumps. It says nothing about a
 * body that goes from crawling to sprinting between two frames, which reads as
 * a whip rather than a cut but is just as much a discontinuity. The settle is
 * where this lives: the blend's first frame closes 1 - exp(-4h) = 1.4% of
 * whatever gap it starts with, so a world left 8 units from its shadow goes
 * from about 0.016 units per frame to 0.16 in one step.
 *
 * Bounded rather than removed, deliberately. Easing the weight in from zero
 * would smooth it and freeze the bodies at the start of every settle, since
 * during a settle the blend is the only thing moving them at all — see
 * `blendWeight`. What the bound is for is the next change: halving the arrival
 * time doubles this number, and without a row watching it that ships green.
 */
// Worlds the renderer would fade in that were already on screen, or new ones
// it would pop into place. See motionWatch.
let fadeInWrong = 0;
let worstJerk = 0;
let worstJerkWhat = "nothing moved";

/**
 * Watches one system's bodies for discontinuities, frame by frame.
 *
 * A helper rather than inline code because the seeded run is not the only
 * place a settle happens. Holding the Stable Era open re-anchors the system
 * every `stableDuration` through the same `beginSettle` the eras use, from
 * worlds that have wandered — measured, up to 1.85x their radius — so it is a
 * settle from a *further* starting gap than anything the seeded loop produces,
 * running for as long as a visitor holds the toggle. It had no instrumentation
 * at all: worst step 0.119 and 0.154 on the two solutions, over half the
 * bound, asserted by nothing.
 *
 * Call `frame` after each `advance`; the watcher keeps its own copy of the
 * previous frame and needs nothing captured beforehand.
 */
function motionWatch(sys: System, where: string) {
  let prevSuns = sys.suns.map((s) => ({ x: s.x, y: s.y }));
  let prevPlanets = sys.planets.map((p) => ({
    x: p.x,
    y: p.y,
    alive: p.alive,
    trail: p.trail.length,
  }));
  let prevSettle = sys.settle;
  // Last frame's step per body, for the C1 bound. Keyed by role and index,
  // which is what identity means here.
  const lastStep = new Map<string, number>();

  return {
    frame(events: SimEvent[]) {
      const collapseHere = events.find((e) => e.type === "collapse");
      const survivedHere = events.some((e) => e.type === "survived");
      const what = survivedHere
        ? "survival"
        : collapseHere
          ? `collapse (${collapseHere.cause})`
          : prevSettle < 1 && sys.settle >= 1
            ? "settle ends, shadow adopted"
            : prevSettle < 1
              ? "settling"
              : "ordinary play";

      const step = (moved: number, who: string, comparable: boolean) => {
        if (moved > worstStep) {
          worstStep = moved;
          worstStepWhat = `${who}, ${what}${where}`;
        }
        const previous = lastStep.get(who);
        if (comparable && previous !== undefined) {
          const jerk = Math.abs(moved - previous);
          if (jerk > worstJerk) {
            worstJerk = jerk;
            worstJerkWhat = `${who}, ${what}${where}`;
          }
        }
        lastStep.set(who, moved);
      };

      // Who the renderer will fade in. `fadesIn` is simulation state, so this
      // is the one part of the opacity bug the harness can hold: the cut it
      // caused was a body already on screen being faded from nothing.
      //
      // A collapse builds new outer worlds against the ghosts of the old ones,
      // so those fade in; Trisolaris is carried across and must not. A
      // survival replaces nothing, so nothing may fade in — that path took
      // every surviving world to alpha 0 in the frame its own notice landed.
      if (collapseHere) {
        if (sys.planets[0].fadesIn) fadeInWrong++;
        for (let i = 1; i < sys.planets.length; i++) {
          if (sys.planets[i].alive && !sys.planets[i].fadesIn) fadeInWrong++;
        }
      } else if (survivedHere) {
        for (const p of sys.planets) if (p.alive && p.fadesIn) fadeInWrong++;
      }

      sys.suns.forEach((s, i) => {
        step(Math.hypot(s.x - prevSuns[i].x, s.y - prevSuns[i].y), `sun ${i}`, true);
      });
      sys.planets.forEach((p, i) => {
        // The home world is carried across a collapse; the outer worlds are
        // rebuilt, so on that one frame index `i` is a different world and
        // neither its step nor the change in its step means anything.
        if (i > 0 && collapseHere) {
          lastStep.delete(`world ${i}`);
          return;
        }
        const was = prevPlanets[i];
        if (!was || !was.alive || !p.alive) return;
        const who = p.isHome ? "home" : `world ${i}`;
        step(Math.hypot(p.x - was.x, p.y - was.y), who, true);
        // A trail may lose one point a frame to `recordTrails` and no more.
        // The exception is a collapse, where `resetInto` truncates the carried
        // home trail to the new orbit's limit — 691 points to 364 on a moth to
        // figure-eight switch, which is deliberate and documented there.
        //
        // Written as a bound on the shrink rather than as "went from something
        // to nothing", which was the first version and would have passed a
        // regression that halved a living world's trail for no reason.
        const shrink = was.trail - p.trail.length;
        if (!collapseHere && shrink > 1) {
          worstTrailShrink = Math.max(worstTrailShrink, shrink);
          trailsWiped++;
        }
      });

      prevSuns = sys.suns.map((s) => ({ x: s.x, y: s.y }));
      prevPlanets = sys.planets.map((p) => ({
        x: p.x,
        y: p.y,
        alive: p.alive,
        trail: p.trail.length,
      }));
      prevSettle = sys.settle;
    },
  };
}

for (const seed of [...SEEDS]) {
  const sys = createSystem();
  const rand = mulberry32(seed);
  // The last thing the notice said, which is not the same as the last cause:
  // surviving a Chaotic Era puts a notice on screen too. Measuring
  // collapse-to-collapse counted drift -> survived -> drift as the notice
  // repeating itself when what the visitor read was three different sentences.
  let previousNotice: CollapseCause | "survived" | null = null;
  let offScreenSince = -1;
  let simTime = 0;
  // New ghosts are counted by identity, and compared against the number of
  // worlds that actually stopped being alive in the same frame. Watching the
  // array merely grow could not tell one death from two: an outer world lost
  // in the frame the home world falls grows it once, and the invariant read
  // that as a world that had vanished without fading.
  const seenGhosts = new WeakSet<Planet>();

  const prevSunPositions = sys.suns.map((s) => ({ x: s.x, y: s.y }));

  const watch = motionWatch(sys, "");

  // This era's worst so far, kept until the era resolves and only then charged
  // to the outcome it resolved into.
  let eraPeakHome = 0;
  let eraPeakSun = 0;
  let eraOffScreen = 0;

  for (let f = 0; f < MINUTES_PER_SEED * 60 * SIM_HZ; f++) {
    const visible = frameRadiusFor(sys.orbit);
    const homeRadius = Math.hypot(sys.planets[0].x, sys.planets[0].y);
    if (homeRadius > visible && offScreenSince < 0) offScreenSince = simTime;
    if (homeRadius <= visible) offScreenSince = -1;

    if (sys.era === "chaotic") {
      eraPeakHome = Math.max(eraPeakHome, homeRadius / sys.planets[0].home);
      for (const s of sys.suns) eraPeakSun = Math.max(eraPeakSun, Math.hypot(s.x, s.y) / visible);
      if (homeRadius > visible) eraOffScreen++;
    }

    // Read before the frame, not after: a collapse has already reset the era
    // by the time its event is handled. This is the era the UI was reporting
    // at the moment anything died in it.
    const stableBefore = sys.era === "stable" && sys.settle >= 1;
    const aliveBefore = sys.planets.filter((pl) => pl.alive).length;
    // Read before the frame because a collapse zeroes all of these on the way
    // out, along with the orbit it was being judged against.
    const heatBefore = sys.heatExposure;
    const coldBefore = sys.coldExposure;
    const syzygyBefore = sys.syzygyDose;
    const wreckedBefore = sys.orbitWrecked;
    const homeBaseBefore = sys.planets[0].home;
    const chaoticBefore = sys.era === "chaotic";
    const events = advance(sys, 1, rand);
    // After the frame as well as before it. A collapse carries the home world
    // across at exactly the position it died at, so this is the only reading
    // that sees the frame the notice landed over; measured at the top of the
    // frame alone, the crossing that ends the era is never sampled at all.
    if (chaoticBefore) {
      maxHomeInFrame = Math.max(
        maxHomeInFrame,
        Math.hypot(sys.planets[0].x, sys.planets[0].y) / visible,
      );
    }
    simTime += SIM_FRAME_TIME;

    watch.frame(events);

    let newGhosts = 0;
    let newHomeGhosts = 0;
    for (const ghost of sys.ghosts) {
      if (seenGhosts.has(ghost)) continue;
      seenGhosts.add(ghost);
      newGhosts++;
      if (ghost.isHome) newHomeGhosts++;
    }
    // How many worlds should have been retired this frame. A collapse retires
    // every world still standing, not only the one that died, so it is the
    // whole standing population; otherwise it is however many went from alive
    // to dead.
    //
    // Counted this way rather than against the number of death *events*,
    // which had four worlds of slack on exactly the frame that matters: a
    // collapse creates a ghost per outer world, so the one event was covered
    // several times over and a missing ghost went unseen.
    //
    // A collapse now retires every standing world *except* Trisolaris, which
    // outlives its civilisations — hence the -1. That exact expression,
    // `pl.alive && !pl.isHome`, was once planted here as a regression to prove
    // this invariant had teeth; it is now the shipped behaviour, and the thing
    // being guarded has inverted. "Trisolaris outlives its civilisations"
    // below watches that side of it.
    const collapsed = events.some((e) => e.type === "collapse");
    const expectedGhosts = collapsed
      ? aliveBefore - 1
      : aliveBefore - sys.planets.filter((pl) => pl.alive).length;
    if (newGhosts < expectedGhosts) deathsWithoutGhost += expectedGhosts - newGhosts;
    if (collapsed && newHomeGhosts > 0) homeGhosted++;

    for (const event of events) {
      if (event.type === "era") {
        if (event.era === "chaotic") {
          chaoticEras++;
          eraPeakHome = 0;
          eraPeakSun = 0;
          eraOffScreen = 0;
        }
      } else if (event.type === "survived") {
        survivals++;
        previousNotice = "survived";
        survivorWorstHome = Math.max(survivorWorstHome, eraPeakHome);
        // Exposure is not cleared until the next Chaotic Era begins, so this
        // is the whole of what the survivors took.
        survivorWorstDose = Math.max(
          survivorWorstDose,
          Math.max(sys.heatExposure, sys.coldExposure) / LETHAL_EXPOSURE,
        );
        survivorWorstSun = Math.max(survivorWorstSun, eraPeakSun);
        survivorFramesOffScreen += eraOffScreen;
      } else if (event.type === "worldLost") {
        outerWorldsLost++;
        deaths++;
        // An outer world counts too. This branch used to carry no invariant at
        // all, so a world dying under a UI reporting a Stable Era — the first
        // failure class this harness exists to catch — went unnoticed for
        // everything except Trisolaris.
        if (stableBefore) deathsDuringStable++;
      } else if (event.type === "collapse") {
        collapses++;
        deaths++;
        causeCounts[event.cause] = (causeCounts[event.cause] ?? 0) + 1;
        // At most one frame of exposure can have been added inside the call
        // that reported this, so the reading from before it must already be
        // within one frame of whatever the cause claims.
        //
        // `drift` is read off the latch, or off where the world ended up: the
        // flag can be set and the era ended inside the same frame, which is
        // invisible from before it, but a collapse carries the home world over
        // at the position it died at, so an out-of-band world is still there to
        // be measured. `syzygy` has to answer for both doses — it is a name for
        // a death by heat, so the heat must have been lethal *and* mostly taken
        // with three suns in the sky.
        const lethalDose = LETHAL_EXPOSURE - SIM_FRAME_TIME;
        const endedAt = Math.hypot(sys.planets[0].x, sys.planets[0].y) / homeBaseBefore;
        const endedOutOfBand =
          endedAt < SURVIVABLE_BAND[0] || endedAt > SURVIVABLE_BAND[1];
        const justified =
          event.cause === "scorched"
            ? heatBefore >= lethalDose
            : event.cause === "frozen"
              ? coldBefore >= lethalDose
              : event.cause === "syzygy"
                ? heatBefore >= lethalDose &&
                  syzygyBefore >= LETHAL_EXPOSURE * SYZYGY_SHARE - SIM_FRAME_TIME
                : wreckedBefore || endedOutOfBand;
        if (!justified) deathsWithoutExposure++;
        if (event.cause === previousNotice) repeats++;
        if (stableBefore) deathsDuringStable++;
        // A collapse must always begin a settle; settle >= 1 means it didn't.
        if (sys.settle >= 1) collapsesWithoutSettle++;
        shortestTrailAfterCollapse = Math.min(
          shortestTrailAfterCollapse,
          ...sys.sunTrails.map((t) => t.length),
        );
        noticeDelays.push(offScreenSince >= 0 ? simTime - offScreenSince : 0);
        previousNotice = event.cause;
        offScreenSince = -1;
      } else if (event.type === "lost") {
        // Counted by its own rig further down, over twice these seeds, because
        // the rate is a design input and this run alone is too small a sample
        // to quote one from. Named here anyway so the exhaustiveness check
        // below stays the thing that catches a new event member.
      } else {
        // Exhaustive on purpose. This chain used to end in a bare `else` that
        // treated anything unrecognised as a collapse, so adding "survived" to
        // SimEvent silently counted every survival as a death: mortality 100%
        // and an `undefined` cause in the tally. Now a new event member fails
        // to assign to `never` and the compiler names the file and line.
        const unhandled: never = event;
        throw new Error(`unhandled simulation event: ${JSON.stringify(unhandled)}`);
      }
    }

    // Every collapse switches orbit, and the two limits differ by 487 points.
    // A trail held over the new limit is drawn more than one closed orbit long,
    // which is neither what drawTrail's alpha ramp assumes nor what the trail
    // is for.
    for (const t of sys.sunTrails) {
      maxTrailExcess = Math.max(maxTrailExcess, t.length - sys.sunTrailLength);
    }
    // The worlds' trails, for the same reason and with a worse blind spot: the
    // home world's trail is now carried across a collapse, and `recordTrails`
    // can only ever remove one point per frame, so an over-long trail arriving
    // from the previous orbit is never drained. Measured before the truncation
    // was added: 691 points against a limit of 364, for 31% of the run.
    for (const p of sys.planets) {
      if (!p.alive) continue;
      maxPlanetTrailExcess = Math.max(
        maxPlanetTrailExcess,
        p.trail.length - sys.planetTrailLength,
      );
    }

    slowestRate = Math.min(slowestRate, sys.timeScale);
    sys.suns.forEach((s, i) => {
      maxSunRadius = Math.max(maxSunRadius, Math.hypot(s.x, s.y));
      peakSunSpeed = Math.max(peakSunSpeed, Math.hypot(s.vx, s.vy));
      const moved = Math.hypot(s.x - prevSunPositions[i].x, s.y - prevSunPositions[i].y);
      prevSunPositions[i] = { x: s.x, y: s.y };
      if (sys.era === "chaotic" && moved > 1e-9) {
        worstCrossing = Math.min(worstCrossing, (visible * 2) / (moved * SIM_HZ));
      }
    });

    if (f === MINUTES_PER_SEED * 60 * SIM_HZ - 1 && sys.era === "chaotic") {
      // The run stopped part-way through a Chaotic Era; it resolved neither way.
      unfinishedChaos++;
    }

    // Every world, not just Trisolaris. Checking `planets[0]` alone left the
    // other radii with no Stable-Era invariant at all: a world planted at a
    // radius this file records as unsurvivable reached 1.58x its own orbit
    // during a Stable Era and the report still printed all-pass.
    if (sys.era === "stable" && sys.settle >= 1) {
      for (const p of sys.planets) {
        if (!p.alive) continue;
        maxWorldWhileStable = Math.max(maxWorldWhileStable, Math.hypot(p.x, p.y) / p.home);
      }
    }
  }
}

const meanDelay = noticeDelays.reduce((a, b) => a + b, 0) / noticeDelays.length;
const sortedDelays = [...noticeDelays].sort((a, b) => a - b);
const p90Delay =
  sortedDelays[Math.min(sortedDelays.length - 1, Math.floor(sortedDelays.length * 0.9))] ?? 0;
const maxDelay = sortedDelays[sortedDelays.length - 1] ?? 0;
const mortality = Math.round((collapses / chaoticEras) * 100);
const repeatRate = Math.round((repeats / collapses) * 100);

record("deaths during a Stable Era", deathsDuringStable, "0", deathsDuringStable === 0);
record("collapses without a settle", collapsesWithoutSettle, "0", collapsesWithoutSettle === 0);
record(
  "every death leaves a ghost",
  `${deaths - deathsWithoutGhost}/${deaths}`,
  "equal",
  deathsWithoutGhost === 0,
);
record(
  "sun trails survive a collapse",
  `${shortestTrailAfterCollapse} points`,
  "> 0",
  shortestTrailAfterCollapse > 0,
);
record("max sun radius", round(maxSunRadius), `<= ${SUN_ESCAPE_RADIUS}`, maxSunRadius <= SUN_ESCAPE_RADIUS + 0.01);
record("any world while stable", `x${round(maxWorldWhileStable)}`, "< x1.10", maxWorldWhileStable < 1.1);
record("worst on-screen crossing", `${round(worstCrossing, 2)}s`, "> 1.0s", worstCrossing > 1);
record("all four causes occur", Object.keys(causeCounts).length, "4", Object.keys(causeCounts).length === 4);
// A civilisation may only be reported as dying of something that happened to
// it: scorched or frozen after LETHAL_EXPOSURE of simulation time in it, a
// tri-solar day only over a lethal heat dose mostly taken under a conjunction,
// drift only over a lost orbit. Without the dose half, the dwell could be
// reduced to an instant — which is what the old model did, and what made a fast
// slingshot past a sun indistinguishable from falling into one — and every
// other number here would look unchanged. Without the other three, a death can
// be renamed into a cause nothing audits, which is how a tri-solar day came to
// be announced over a civilisation that froze.
record(
  "no death without the exposure to justify it",
  `${deathsWithoutExposure} of ${collapses}`,
  "0",
  deathsWithoutExposure === 0,
);
// Trisolaris is not one of the eleven. If a collapse ever retires the home
// world, every notice on the site is describing a planet's death while
// claiming a civilisation's.
record(
  "Trisolaris outlives its civilisations",
  `${homeGhosted} collapses ghosted the home world`,
  "0",
  homeGhosted === 0,
);
record("consecutive notices repeating", `${repeats}/${collapses} (${repeatRate}%)`, "< 20%", repeatRate < 20);
// The worst, not the mean. Killing the home world on accumulated cold rather
// than instantly at escapeRadiusFor let it drift off screen for up to
// LETHAL_EXPOSURE of sim time before its notice landed: against `main` the mean
// improved 3x (0.30s -> 0.10s) while the max regressed 40% (2.50s -> 3.52s),
// past this row's own threshold, and the row reported a win. A mean cannot see
// the failure this row exists for — the ESCAPE_FACTOR doc names it and quotes a
// max — so the max is what is asserted and the mean is printed beside it.
record(
  "notice delay after leaving view",
  `max ${toSeconds(maxDelay)}s (mean ${toSeconds(meanDelay)}s, p90 ${toSeconds(p90Delay)}s)`,
  "max < 2.0s",
  toSeconds(maxDelay) < 2,
);
record("mortality", `${mortality}%`, "40-80%", mortality >= 40 && mortality <= 80);
// What "survived" has to mean on screen. Before survival was judged over the
// whole era rather than at its last frame, the worst survivor peaked at 1.717x
// its own radius — 1.24x the frame — and survivors spent 20 eras' worth of
// time off screen entirely, up to 4.9s at a stretch.
record(
  "a survivor holds its orbit",
  `worst x${round(survivorWorstHome)}`,
  `<= x${SURVIVABLE_BAND[1]}`,
  survivorWorstHome <= SURVIVABLE_BAND[1] + 1e-9,
);
record(
  "a survivor never leaves the frame",
  `${survivorFramesOffScreen} frames`,
  "0",
  survivorFramesOffScreen === 0,
);
// Not enforced anywhere in the simulation: a Chaotic Era mild enough for the
// home world to hold its orbit is one the suns did not run wild in either.
// Asserted because it is the other half of what the notice implies, and
// because nothing else would notice if it stopped being true.
record(
  "a survivor's suns stay in frame",
  `worst x${round(survivorWorstSun)}`,
  "< x1.0",
  survivorWorstSun < 1,
);
// The home world stays in the picture it is being judged in. Nothing in the
// simulation bounded it before: the suns have SUN_ESCAPE_RADIUS, survivors have
// SURVIVABLE_BAND, and the home world of a civilisation about to die had
// neither — it reached 6.44 against the moth's frame of 6.36, and the notice
// describing it landed seconds later. A Chaotic Era now ends when the world
// leaves the frame, which is a claim about *when* the notice lands and not
// about who dies: the frame edge is outside the band on both solutions (
// asserted per orbit below), so the orbit is already lost by the time this can
// hold. The slack is one frame of the world's own motion, since the crossing
// happens inside a frame and the era ends at the end of it.
record(
  "the home world stays in the frame",
  `worst x${round(maxHomeInFrame)}`,
  "< x1.02",
  maxHomeInFrame < 1.02,
);
// A Chaotic Era has exactly two endings and both are announced. Surviving used
// to be reported by nothing at all, which on screen was indistinguishable from
// a death whose notice had failed — so assert every era reaches one of them.
record(
  "every Chaotic Era resolves",
  `${collapses} died + ${survivals} survived + ${unfinishedChaos} running`,
  `${chaoticEras}`,
  collapses + survivals + unfinishedChaos === chaoticEras,
);
record(
  "sun trail within its orbit's limit",
  `worst excess ${maxTrailExcess}`,
  "0",
  maxTrailExcess <= 0,
);
// The counterpart for the worlds, which did not exist — which is the only
// reason a home trail 90% over its limit for a third of the run went green.
record(
  "world trail within its orbit's limit",
  `worst excess ${maxPlanetTrailExcess}`,
  "0",
  maxPlanetTrailExcess <= 0,
);

/* --------------------------------------------------------------------------
   "Hold Stable Era" has to hold a Stable Era.

   The run above never touches the toggle, which is how a pinned system came to
   spend ten minutes killing civilisations behind a UI reporting a Stable Era.
   Pinned, the simulation never reaches `destabilise` and so never draws from
   `rand` — one run is the entire behaviour, not one sample of it.
   -------------------------------------------------------------------------- */
const PINNED_MINUTES = 10;
let pinnedDeaths = 0;
let pinnedNonStable = 0;
{
  const sys = createSystem();
  const rand = mulberry32(SEEDS[0]);
  // Pinned three seconds in — the button's normal use.
  advance(sys, 3 * SIM_HZ, rand);
  sys.pinned = true;

  const watch = motionWatch(sys, ", pinned");

  for (let f = 0; f < PINNED_MINUTES * 60 * SIM_HZ; f++) {
    const events = advance(sys, 1, rand);
    watch.frame(events);
    for (const event of events) {
      if (event.type === "collapse" || event.type === "worldLost") pinnedDeaths++;
    }
    if (sys.era !== "stable") pinnedNonStable++;
  }
}
record(`deaths while pinned (${PINNED_MINUTES} min)`, pinnedDeaths, "0", pinnedDeaths === 0);
record("pinned frames outside a Stable Era", pinnedNonStable, "0", pinnedNonStable === 0);

/* --------------------------------------------------------------------------
   Every world in ORBITS holds its own orbit — this is where the radii in that
   table come from.

   Nothing above covers most of them. The long run only reaches the moth by
   collapsing into it, which samples chaos rather than the Stable Era the radii
   were chosen for; the pinned run starts at civilisation 1 and, being pinned,
   never leaves it. So each solution gets its own rig. Pinned, a Stable Era is
   re-seeded from the validated initial conditions every `stableDuration`, so
   running one is a clean repeat of the era every world actually has to live
   through, and the worst peak radius over eight of them is the number that
   decides whether a radius belongs in the table.

   Peak and not a symmetric band: these orbits are ellipses. The figure-eight's
   home world dips to 0.784 of its radius every era, so a symmetric band would
   reject the shipping site.

   The home world's floor is measured here too, and both ends asserted against
   the `homeExcursion` in the table — three comments cite those numbers as the
   reason the band is shaped the way it is, and until now nothing checked them.
   The band is then asserted to admit the whole undisturbed range: an orbit
   whose ordinary motion fell outside it could never be survived at all, and
   the run would go green reporting 100% mortality as if that were physics.
   -------------------------------------------------------------------------- */
const ERAS_PER_ORBIT = 8;
/** How far the measured excursion may sit from the table before it is stale. */
const EXCURSION_TOLERANCE = 0.002;
type WorldPeak = { orbit: string; r: number; angle: number; home: boolean; peak: number };
const worldPeaks: WorldPeak[] = [];
const homeRanges: { orbit: string; low: number; high: number }[] = [];

for (let ci = 1; ci <= ORBITS.length; ci++) {
  const orbit = ORBITS[ci - 1];
  const sys = createSystem(ci);
  const rand = mulberry32(SEEDS[0]);
  sys.pinned = true;

  const peaks = orbit.worlds.map(() => 0);
  let homeLow = Infinity;
  let fluxLow = Infinity;
  let fluxHigh = 0;
  let eras = 0;
  let settled = true;
  // A Stable Era is `stableDuration` of simulation time plus the settle in
  // front of it; the slack covers the settle and any throttling. Whether the
  // eras were actually reached is asserted below rather than assumed.
  const cap = Math.ceil(((orbit.stableDuration + 8) * ERAS_PER_ORBIT * 2) / SIM_FRAME_TIME);

  const watch = motionWatch(sys, `, pinned ${orbit.id}`);

  for (let f = 0; f < cap && eras < ERAS_PER_ORBIT; f++) {
    watch.frame(advance(sys, 1, rand));
    if (sys.settle >= 1) {
      settled = true;
    } else if (settled) {
      // Pinned, the only way settle drops is a re-seed: one era just ended.
      settled = false;
      eras++;
    }
    if (sys.era === "stable" && sys.settle >= 1) {
      sys.planets.forEach((p, i) => {
        if (p.alive) peaks[i] = Math.max(peaks[i], Math.hypot(p.x, p.y) / p.home);
      });
      const home = sys.planets[0];
      if (home.alive) {
        homeLow = Math.min(homeLow, Math.hypot(home.x, home.y) / home.home);
        const f = fluxOn(home, sys.suns);
        fluxLow = Math.min(fluxLow, f);
        fluxHigh = Math.max(fluxHigh, f);
      }
    }
  }

  record(
    `${orbit.id}: Stable Eras measured`,
    eras,
    `${ERAS_PER_ORBIT}`,
    eras === ERAS_PER_ORBIT,
  );
  orbit.worlds.forEach((w, i) => {
    worldPeaks.push({ orbit: orbit.id, r: w.r, angle: w.angle, home: i === 0, peak: peaks[i] });
  });
  const worst = Math.max(...peaks);
  record(
    `${orbit.id}: every world holds its orbit`,
    `x${round(worst)}`,
    "< x1.10",
    worst < 1.1,
  );

  homeRanges.push({ orbit: orbit.id, low: homeLow, high: peaks[0] });
  const [tableLow, tableHigh] = orbit.homeExcursion;
  const stale = Math.max(Math.abs(homeLow - tableLow), Math.abs(peaks[0] - tableHigh));
  record(
    `${orbit.id}: home excursion matches the table`,
    `[x${round(homeLow)}, x${round(peaks[0])}] vs [x${tableLow}, x${tableHigh}]`,
    `within ${EXCURSION_TOLERANCE}`,
    stale <= EXCURSION_TOLERANCE,
  );

  // SCORCH_MULTIPLE and FREEZE_FRACTION are read against this band, so a stale
  // entry moves how much sky a civilisation may take before it dies — silently,
  // and differently for each solution. The two bands are nowhere near each
  // other (the figure-eight's home world stands in two to five times the light
  // the moth's does), which is exactly why one absolute threshold could not
  // work and why these have to be per orbit and measured.
  const [fluxTableLow, fluxTableHigh] = orbit.homeFlux;
  const fluxStale = Math.max(
    Math.abs(fluxLow - fluxTableLow),
    Math.abs(fluxHigh - fluxTableHigh),
  );
  record(
    `${orbit.id}: home flux matches the table`,
    `[${round(fluxLow, 4)}, ${round(fluxHigh, 4)}] vs [${fluxTableLow}, ${fluxTableHigh}]`,
    `within ${EXCURSION_TOLERANCE}`,
    fluxStale <= EXCURSION_TOLERANCE,
  );

  // The band has to leave room on both sides of an orbit nothing has happened
  // to. Without this, tightening it — or adding a solution with a wider
  // ellipse — makes survival impossible and reports it as mortality.
  const roomBelow = homeLow - SURVIVABLE_BAND[0];
  const roomAbove = SURVIVABLE_BAND[1] - peaks[0];
  record(
    `${orbit.id}: the band admits an undisturbed orbit`,
    `room ${round(roomBelow)} below, ${round(roomAbove)} above`,
    "both > 0",
    roomBelow > 0 && roomAbove > 0,
  );

  // A Chaotic Era ends when the home world leaves the frame, and that must not
  // be a way of killing a civilisation that was otherwise fine. It isn't, as
  // long as the frame edge lies beyond the top of the band: a world that far
  // out lost its orbit on the way, so `orbitWrecked` is already set. If a new
  // solution were ever placed with its frame *inside* the band, that terminator
  // would quietly become a cause of death nothing announced.
  const bandTop = orbit.worlds[0].r * SURVIVABLE_BAND[1];
  const frameRoom = frameRadiusFor(orbit) - bandTop;
  record(
    `${orbit.id}: the frame edge is outside the band`,
    `frame ${round(frameRadiusFor(orbit))} vs band top ${round(bandTop)}`,
    "> 0",
    frameRoom > 0,
  );
}

/* --------------------------------------------------------------------------
   How often Trisolaris is lost, which is the pacing of the site's ending.

   Its own rig, over twice the seeds of the long run, because this number is a
   design input rather than a bound: #18 gates the ending on it and budgets a
   visitor's wait against it. The long run alone found 4 events in 75 minutes,
   and a Poisson interval on n = 4 spans one-per-7-minutes to one-per-70 — too
   wide to design against, and wide enough that the figure the ticket quotes
   was not measured by anything that shipped.
   -------------------------------------------------------------------------- */
const UNBOUND_SEEDS = [...SEEDS, 1, 42, 777, 2718, 161803];
const UNBOUND_MINUTES = 15;
let planetLost = 0;
let civilizationsLost = 0;
for (const seed of UNBOUND_SEEDS) {
  const sys = createSystem();
  const rand = mulberry32(seed);
  for (let f = 0; f < UNBOUND_MINUTES * 60 * SIM_HZ; f++) {
    for (const event of advance(sys, 1, rand)) {
      if (event.type === "lost") planetLost++;
      if (event.type === "collapse") civilizationsLost++;
    }
  }
}
const unboundMinutes = UNBOUND_SEEDS.length * UNBOUND_MINUTES;

/* --------------------------------------------------------------------------
   Motion, across every rig above.

   These are recorded here rather than beside the long run because they are fed
   by all three rigs — the seeded eras, the pinned re-anchor and the per-orbit
   Stable Era measurement — and a  call reads its value at the moment it
   runs. Placed with the long run, they were captured before the two pinned rigs
   had executed, so those contributed nothing and the row read as though they
   had been checked. That is the same shape as the finding that added them.
   -------------------------------------------------------------------------- */
// The simulation is watched, so a body that jumps is a defect however correct
// the state it jumps to. Every other invariant here reads the state; this one
// reads the motion, which is why two teleports could ship under a green run.
record(
  "the animation never cuts",
  `worst ${round(worstStep)} (${worstStepWhat})`,
  `< ${STEP_LIMIT} units`,
  worstStep < STEP_LIMIT,
);
// C1 as well as C0. A body that goes from crawling to sprinting between two
// frames has not jumped, and still reads as a discontinuity. The bound is 0.3
// as well, which is where the two measures happen to meet: the worst change is
// 0.151 at the start of a settle, so the same headroom applies.
record("no world fades in that was already here", fadeInWrong, "0", fadeInWrong === 0);
// Reported, not asserted. #18 gates the site's ending on this event, so the
// rate is a design input: how long a visitor past the counter threshold waits
// to see the fleet depart. A pass/fail here would be asserting a taste.
// What a returning visitor is told they missed is derived from
// CIVILIZATIONS_PER_HOUR, and the page cannot check it. So it is checked here.
// The figure this replaced went 61% wrong sitting still while four other
// changes moved mortality underneath it, which is exactly the failure a
// recomputed number cannot have.
//
// The tolerance is 8%: measured across these ten seeds the rate is 102/hour,
// and the spread between seeds is a few per cent, so this catches a model
// change without firing on seed noise.
const measuredPerHour = (civilizationsLost / (unboundMinutes * 60)) * 3600;
const rateDrift = Math.abs(measuredPerHour - CIVILIZATIONS_PER_HOUR) / CIVILIZATIONS_PER_HOUR;
record(
  "civilisations per hour matches the constant",
  `${round(measuredPerHour, 1)} vs ${CIVILIZATIONS_PER_HOUR}`,
  "within 8%",
  rateDrift < 0.08,
);
record(
  "Trisolaris reported unbound",
  `${planetLost} in ${unboundMinutes} min (one per ${round(unboundMinutes / Math.max(1, planetLost), 1)} min)`,
  "reported",
  true,
);
record(
  "the animation never whips",
  `worst ${round(worstJerk)} (${worstJerkWhat})`,
  `< ${STEP_LIMIT} units`,
  worstJerk < STEP_LIMIT,
);
record(
  "no trail is cut from a living world",
  trailsWiped === 0 ? "0" : `${trailsWiped} (worst ${worstTrailShrink} points)`,
  "0",
  trailsWiped === 0,
);

/* -------------------------------------------------------------------------- */

const failed = checks.filter((c) => !c.pass);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        simulatedMinutes: SEEDS.length * MINUTES_PER_SEED,
        pinnedMinutes: PINNED_MINUTES,
        seeds: SEEDS,
        closure,
        chaoticEras,
        collapses,
        survivals,
        mortality,
        repeatRate,
        outerWorldsLost,
        causeCounts,
        maxSunRadius: round(maxSunRadius),
        peakSunSpeed: round(peakSunSpeed),
        slowestRate: round(slowestRate),
        worstCrossing: round(worstCrossing, 2),
        worstStep: round(worstStep),
        worstStepWhat,
        trailsWiped,
        worstJerk: round(worstJerk),
        worstJerkWhat,
        worldPeaks: worldPeaks.map((w) => ({ ...w, peak: round(w.peak) })),
        checks,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\nTrisolaran simulation report`);
  console.log(
    `${SEEDS.length * MINUTES_PER_SEED} simulated minutes across seeds ${SEEDS.join(", ")}, plus ${PINNED_MINUTES} pinned\n`,
  );
  const width = Math.max(...checks.map((c) => c.name.length));
  // Measured like the name column rather than fixed at 26, which one long
  // value was enough to overflow — and the only row whose `expected` sat in a
  // different column was the one a reader most wanted to compare. This report
  // is read by eye, diffing one run against another, and a ragged column is
  // exactly what makes that hard.
  const valueWidth = Math.max(...checks.map((c) => c.value.length));
  for (const c of checks) {
    console.log(
      `  ${c.pass ? "PASS" : "FAIL"}  ${c.name.padEnd(width)}  ${c.value.padEnd(valueWidth)} expected ${c.expected}`,
    );
  }
  console.log(
    `\n  chaotic eras ${chaoticEras}, collapses ${collapses}, survivals ${survivals}, outer worlds lost ${outerWorldsLost}`,
  );
  console.log(`  causes ${JSON.stringify(causeCounts)}`);
  console.log(
    `  worst dose a civilisation survived ${round(survivorWorstDose)} of the lethal exposure`,
  );
  console.log(`  peak sun speed ${round(peakSunSpeed)}, slowest rate ${round(slowestRate)}x`);

  // Printed per world, not just as the worst: this is the provenance of every
  // radius in ORBITS, and a reader auditing one of them needs its own number.
  // The home world's own orbit against the band it has to stay inside. The
  // two solutions are not equally placed in it, which is measured rather
  // than incidental — see the 2026-09-08 review.
  console.log(`\n  home world's orbit against SURVIVABLE_BAND [${SURVIVABLE_BAND.join(", ")}]`);
  for (const r of homeRanges) {
    console.log(
      `    ${r.orbit.padEnd(13)} runs [x${round(r.low)}, x${round(r.high)}]` +
        `   room ${round(r.low - SURVIVABLE_BAND[0])} below, ${round(SURVIVABLE_BAND[1] - r.high)} above`,
    );
  }

  console.log(`\n  peak radius per world, over ${ERAS_PER_ORBIT} pinned Stable Eras each`);
  for (const orbit of ORBITS) {
    console.log(`    ${orbit.id}`);
    for (const w of worldPeaks.filter((p) => p.orbit === orbit.id)) {
      console.log(
        `      ${(w.home ? "home " : "world").padEnd(5)}  r=${String(w.r).padEnd(5)} ${String(w.angle).padStart(3)}deg   peak x${round(w.peak)}`,
      );
    }
  }
  console.log();
}

if (failed.length > 0) {
  console.error(`${failed.length} invariant(s) failed: ${failed.map((c) => c.name).join("; ")}\n`);
  process.exit(1);
}
