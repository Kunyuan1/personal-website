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
  type CollapseCause,
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
let ghostsCreated = 0;
let shortestTrailAfterCollapse = Infinity;
let maxTrailExcess = 0;
let maxSunRadius = 0;
let maxHomeWhileStable = 0;
let peakSunSpeed = 0;
let slowestRate = 1;
let worstCrossing = Infinity;
const noticeDelays: number[] = [];
const causeCounts: Partial<Record<CollapseCause, number>> = {};

for (const seed of [...SEEDS]) {
  const sys = createSystem();
  const rand = mulberry32(seed);
  let previousCause: CollapseCause | null = null;
  let offScreenSince = -1;
  let simTime = 0;
  let insideChaos = false;
  const prevSunPositions = sys.suns.map((s) => ({ x: s.x, y: s.y }));

  for (let f = 0; f < MINUTES_PER_SEED * 60 * SIM_HZ; f++) {
    const visible = sys.orbit.planetRadii[sys.orbit.planetRadii.length - 1] * 1.06;
    const homeRadius = Math.hypot(sys.planets[0].x, sys.planets[0].y);
    if (homeRadius > visible && offScreenSince < 0) offScreenSince = simTime;
    if (homeRadius <= visible) offScreenSince = -1;

    const ghostsBefore = sys.ghosts.length;
    const events = advance(sys, 1, rand);
    simTime += SIM_FRAME_TIME;
    if (sys.ghosts.length > ghostsBefore) ghostsCreated++;

    for (const event of events) {
      if (event.type === "era") {
        if (event.era === "chaotic") {
          chaoticEras++;
          insideChaos = true;
        }
      } else if (event.type === "survived") {
        survivals++;
        insideChaos = false;
      } else if (event.type === "worldLost") {
        outerWorldsLost++;
        deaths++;
      } else {
        collapses++;
        deaths++;
        causeCounts[event.cause] = (causeCounts[event.cause] ?? 0) + 1;
        if (event.cause === previousCause) repeats++;
        if (!insideChaos) deathsDuringStable++;
        // A collapse must always begin a settle; settle >= 1 means it didn't.
        if (sys.settle >= 1) collapsesWithoutSettle++;
        shortestTrailAfterCollapse = Math.min(
          shortestTrailAfterCollapse,
          ...sys.sunTrails.map((t) => t.length),
        );
        noticeDelays.push(offScreenSince >= 0 ? simTime - offScreenSince : 0);
        previousCause = event.cause;
        offScreenSince = -1;
        insideChaos = false;
      }
    }

    // Every collapse switches orbit, and the two limits differ by 487 points.
    // A trail held over the new limit is drawn more than one closed orbit long,
    // which is neither what drawTrail's alpha ramp assumes nor what the trail
    // is for.
    for (const t of sys.sunTrails) {
      maxTrailExcess = Math.max(maxTrailExcess, t.length - sys.sunTrailLength);
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

    if (sys.era === "stable" && sys.settle >= 1) {
      const home = sys.planets[0];
      maxHomeWhileStable = Math.max(
        maxHomeWhileStable,
        Math.hypot(home.x, home.y) / home.home,
      );
    }
  }
}

const meanDelay = noticeDelays.reduce((a, b) => a + b, 0) / noticeDelays.length;
const mortality = Math.round((collapses / chaoticEras) * 100);
const repeatRate = Math.round((repeats / collapses) * 100);

record("deaths during a Stable Era", deathsDuringStable, "0", deathsDuringStable === 0);
record("collapses without a settle", collapsesWithoutSettle, "0", collapsesWithoutSettle === 0);
record("every death leaves a ghost", `${ghostsCreated}/${deaths}`, "equal", ghostsCreated === deaths);
record(
  "sun trails survive a collapse",
  `${shortestTrailAfterCollapse} points`,
  "> 0",
  shortestTrailAfterCollapse > 0,
);
record("max sun radius", round(maxSunRadius), `<= ${SUN_ESCAPE_RADIUS}`, maxSunRadius <= SUN_ESCAPE_RADIUS + 0.01);
record("home world while stable", `x${round(maxHomeWhileStable)}`, "< x1.10", maxHomeWhileStable < 1.1);
record("worst on-screen crossing", `${round(worstCrossing, 2)}s`, "> 1.0s", worstCrossing > 1);
record("all five causes occur", Object.keys(causeCounts).length, "5", Object.keys(causeCounts).length === 5);
record("consecutive repeats", `${repeats}/${collapses} (${repeatRate}%)`, "< 20%", repeatRate < 20);
record("notice delay after leaving view", `mean ${toSeconds(meanDelay)}s`, "< 2.0s", toSeconds(meanDelay) < 2);
record("mortality", `${mortality}%`, "40-80%", mortality >= 40 && mortality <= 80);
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

  for (let f = 0; f < PINNED_MINUTES * 60 * SIM_HZ; f++) {
    for (const event of advance(sys, 1, rand)) {
      if (event.type === "collapse" || event.type === "worldLost") pinnedDeaths++;
    }
    if (sys.era !== "stable") pinnedNonStable++;
  }
}
record(`deaths while pinned (${PINNED_MINUTES} min)`, pinnedDeaths, "0", pinnedDeaths === 0);
record("pinned frames outside a Stable Era", pinnedNonStable, "0", pinnedNonStable === 0);

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
  for (const c of checks) {
    console.log(
      `  ${c.pass ? "PASS" : "FAIL"}  ${c.name.padEnd(width)}  ${c.value.padEnd(26)} expected ${c.expected}`,
    );
  }
  console.log(
    `\n  chaotic eras ${chaoticEras}, collapses ${collapses}, survivals ${survivals}, outer worlds lost ${outerWorldsLost}`,
  );
  console.log(`  causes ${JSON.stringify(causeCounts)}`);
  console.log(`  peak sun speed ${round(peakSunSpeed)}, slowest rate ${round(slowestRate)}x\n`);
}

if (failed.length > 0) {
  console.error(`${failed.length} invariant(s) failed: ${failed.map((c) => c.name).join("; ")}\n`);
  process.exit(1);
}
