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
  type CollapseCause,
  type Planet,
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
let maxSunRadius = 0;
let maxWorldWhileStable = 0;
let peakSunSpeed = 0;
let slowestRate = 1;
let worstCrossing = Infinity;
const noticeDelays: number[] = [];
const causeCounts: Partial<Record<CollapseCause, number>> = {};
// The worst any survivor did, over every Chaotic Era that was survived. A
// survival is a claim about the animation as much as about the state: the
// notice says the world came through, so the world has to have been visibly
// there to come through. See SURVIVABLE_BAND.
let survivorWorstHome = 0;
let survivorWorstSun = 0;
let survivorFramesOffScreen = 0;

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
  // deaths in the same frame. Watching the array merely grow could not tell
  // one death from two: an outer world lost in the frame the home world falls
  // grows it once, and the invariant read that as a world that had vanished
  // without fading.
  const seenGhosts = new WeakSet<Planet>();

  const prevSunPositions = sys.suns.map((s) => ({ x: s.x, y: s.y }));

  // This era's worst so far, kept until the era resolves and only then charged
  // to the outcome it resolved into.
  let eraPeakHome = 0;
  let eraPeakSun = 0;
  let eraOffScreen = 0;

  for (let f = 0; f < MINUTES_PER_SEED * 60 * SIM_HZ; f++) {
    const visible = sys.orbit.worlds[sys.orbit.worlds.length - 1].r * 1.06;
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
    const events = advance(sys, 1, rand);
    simTime += SIM_FRAME_TIME;
    let newGhosts = 0;
    for (const ghost of sys.ghosts) {
      if (seenGhosts.has(ghost)) continue;
      seenGhosts.add(ghost);
      newGhosts++;
    }
    // A collapse retires every world still standing, not only the one that
    // died, so this is >= rather than ===.
    const deathsThisFrame = events.filter(
      (e) => e.type === "collapse" || e.type === "worldLost",
    ).length;
    if (newGhosts < deathsThisFrame) deathsWithoutGhost += deathsThisFrame - newGhosts;

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
record("all five causes occur", Object.keys(causeCounts).length, "5", Object.keys(causeCounts).length === 5);
record("consecutive notices repeating", `${repeats}/${collapses} (${repeatRate}%)`, "< 20%", repeatRate < 20);
record("notice delay after leaving view", `mean ${toSeconds(meanDelay)}s`, "< 2.0s", toSeconds(meanDelay) < 2);
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
   -------------------------------------------------------------------------- */
const ERAS_PER_ORBIT = 8;
type WorldPeak = { orbit: string; r: number; angle: number; home: boolean; peak: number };
const worldPeaks: WorldPeak[] = [];

for (let ci = 1; ci <= ORBITS.length; ci++) {
  const orbit = ORBITS[ci - 1];
  const sys = createSystem(ci);
  const rand = mulberry32(SEEDS[0]);
  sys.pinned = true;

  const peaks = orbit.worlds.map(() => 0);
  let eras = 0;
  let settled = true;
  // A Stable Era is `stableDuration` of simulation time plus the settle in
  // front of it; the slack covers the settle and any throttling. Whether the
  // eras were actually reached is asserted below rather than assumed.
  const cap = Math.ceil(((orbit.stableDuration + 8) * ERAS_PER_ORBIT * 2) / SIM_FRAME_TIME);

  for (let f = 0; f < cap && eras < ERAS_PER_ORBIT; f++) {
    advance(sys, 1, rand);
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
}

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
  console.log(`  peak sun speed ${round(peakSunSpeed)}, slowest rate ${round(slowestRate)}x`);

  // Printed per world, not just as the worst: this is the provenance of every
  // radius in ORBITS, and a reader auditing one of them needs its own number.
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
