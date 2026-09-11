"use client";

import { usePathname } from "next/navigation";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  advance,
  CIVILIZATIONS_PER_HOUR,
  createSystem,
  SIM_HZ,
  type CollapseCause,
  type Era,
  type System,
} from "@/lib/trisolaris";

const CIVILIZATION_KEY = "trisolaris.civilization";
const STABILISED_KEY = "trisolaris.stabilised";
/**
 * That the fleet has departed, and the civilisation it departed after. Written
 * when it happens and read exactly once, on the next visit.
 *
 * Deliberately not a resumable state. Reaching the ending is cumulative across
 * visits, but a departed system must not be what a returning visitor lands on:
 * the hero is the first thing on a portfolio page, and a permanently dead one
 * is a cost paid on every visit thereafter by someone who never asked. So the
 * *fact* persists — the ending was earned and is acknowledged on return — and
 * the system itself comes back.
 */
const DEPARTED_KEY = "trisolaris.departed";
/**
 * When this visitor was last here, in epoch milliseconds. Written whenever the
 * page goes away and read once on the way back, to work out how long the
 * hibernation lasted.
 */
const LAST_SEEN_KEY = "trisolaris.lastSeen";
/**
 * That this visitor has already watched the system rise out of the page.
 *
 * A dedicated key rather than inferring a first visit from the absence of the
 * others: the presence beat writes `lastSeen` on load, so "no history" is true
 * for a moment and then is not, and #9's findings are all about exactly that
 * kind of inference being fragile.
 */
const RISEN_KEY = "trisolaris.risen";
/**
 * How long away counts as a hibernation rather than a moment's inattention.
 *
 * Half an hour, from the ticket. Well clear of DEHYDRATION_MS, which is the
 * five seconds that make the *animation* treat a return as a rehydration:
 * that one is about the trails being dry, this one is about telling somebody
 * what they missed, and they should not fire together on a lunch break.
 */
const HIBERNATION_MIN_MS = 30 * 60 * 1000;
/**
 * How often presence is recorded while someone is actually looking.
 *
 * A tab that is closed cleanly fires `pagehide`, and one that is hidden fires
 * `visibilitychange` — but a tab that crashes, is force-quit, or is discarded
 * under memory pressure fires neither, and the whole session then counts as
 * time away. A minute of that is invisible against a thirty-minute threshold;
 * an hour of reading is not.
 *
 * Only while visible. Beating in a hidden tab would quietly erase the very
 * absence this is here to measure.
 */
const PRESENCE_BEAT_MS = 60000;
/**
 * How long the descent notice stays up.
 *
 * It goes up as the rise begins rather than after it lands, because it is a
 * caption for something happening on screen and not a report of something
 * that has finished. RISE_MS of that is spent with the system still opening,
 * which leaves about seven seconds to read two sentences — near the collapse
 * notice's allowance, which is the closest in length.
 */
const RISE_NOTICE_MS = 9000;

/** The hibernation notice is three sentences, and needs longer than a death. */
const HIBERNATION_NOTICE_MS = 11000;
/**
 * How many civilisations must have come and gone before the simulation losing
 * Trisolaris means the end rather than a catastrophe lived through.
 *
 * Measured, a collapse lands every 35 seconds or so, which puts this about 15
 * minutes of cumulative watching away — spread over as many visits as someone
 * likes, since the counter persists, and counting only time actually spent
 * looking, because a hidden tab dehydrates. Past it, the simulation reports the
 * planet unbound about once every 17 minutes — 9 events over 150 simulated
 * minutes, from the rig `npm run sim:report` runs for exactly this number.
 * It used to be quoted from the long run alone, which found 4 events in 75
 * minutes: a sample whose Poisson interval spans one-per-7-minutes to
 * one-per-70, which is not a figure to budget a visitor's wait against.
 *
 * It was 50, sized against an ending that persisted — a permanently dead hero
 * on the front of a portfolio was a cost worth putting half an hour in front
 * of. That ending is gone: DEPARTED_KEY now re-forms the system on the next
 * visit, so what the gate protects is only the surprise, and the whole arc at
 * 50 came to about 46 minutes of deliberate attention. Nobody was ever going
 * to spend that, and an ending nobody reaches is code with no reader.
 *
 * 25 halves the approach without making it reachable by accident: 15 minutes
 * of *watching* is far more than a first visit, and the escape wait past the
 * gate is unchanged. Going lower buys little, since that 17-minute wait is the
 * term that dominates and no gate can shorten it.
 *
 * The gate lives here rather than in the simulation because the counter does.
 * `advance` reports what happened to the planet and decides nothing, which is
 * also what makes this trivially testable: set
 * `localStorage["trisolaris.civilization"]` to 25 and wait.
 */
const DEPARTURE_AT = 25;
/**
 * How long the system takes to rise out of the flat page, in milliseconds.
 *
 * On a first visit the hero begins as a single luminous line — the whole
 * system compressed onto one row, every trail and glow preserved and stacked
 * — and opens into three dimensions. The page is not *showing* the flattened
 * thing; the page **is** it, and the system comes out of it.
 *
 * 2000ms is a starting guess, chosen the way REHYDRATION_MS was not: that one
 * was watched at 900, 1500 and 3000 before it settled at 1500. This wants the
 * same treatment, and is the one number in this feature that cannot be
 * decided before it is seen.
 */
const RISE_MS = 2000;

/** Most simulation time a single animation frame may catch up on, in seconds. */
const MAX_CATCHUP = 0.5;
/** How long the collapse notice stays on screen. */
const COLLAPSE_NOTICE_MS = 9200;
/** Surviving has less to say, and stays up for less time saying it. */
const SURVIVAL_NOTICE_MS = 6400;
/**
 * How long the tab must stay hidden before coming back to it counts as a
 * dehydration. A quick alt-tab is not a Chaotic Era, and should not have to
 * sit through an animation proving it.
 */
const DEHYDRATION_MS = 5000;
/**
 * How long the return from one takes. Watched by eye at 900, 1500 and 3000:
 * 900 is over before you have found the suns, 3000 holds the page hostage on
 * every return. 1500 is the one you cannot miss and do not wait through.
 */
const REHYDRATION_MS = 1500;

/**
 * Draws the system, and takes two render-only ramps along with it.
 *
 * `hydration` is rehydration progress: 1 whenever the page is simply running,
 * easing 0 -> 1 on the way back from a dehydration.
 *
 * `rise` is dimensional: 0 is the system flat, compressed onto a single line,
 * and 1 is the system in three dimensions. It runs once, on a visitor's first
 * ever visit, and is 1 for everyone else.
 *
 * Both are passed rather than stored on the system, because they are
 * rendering concerns and the physics must not be able to see them.
 */
type Renderer = (system: System, hydration: number, rise: number) => void;

/**
 * What just became of the current civilisation. A Chaotic Era resolves one way
 * or the other and both are worth announcing — reporting only the deaths left
 * a survival looking like a notice that had failed to appear.
 */
export type Notice =
  | { kind: "collapse"; civilization: number; cause: CollapseCause }
  | { kind: "survived"; civilization: number }
  /**
   * How long this visitor was gone, and what the system did without them.
   *
   * `civilizations` is an estimate and is deliberately not added to the
   * counter: the simulation is paused while nobody is looking, so none of it
   * literally happened. Advancing the count instead would make a visitor
   * civilisation #40,000 within a month, and the number would stop meaning
   * anything. The copy says *estimated* and carries the inconsistency in the
   * open, which is more interesting than an illusion that has to be
   * maintained.
   */
  | { kind: "hibernation"; awayMs: number; civilizations: number }
  /**
   * The system coming out of the flattened page, on a first visit.
   *
   * Carries nothing. The other three report an outcome the visitor could not
   * have predicted; this one names a thing they are watching happen, and the
   * only fact in it is that it is happening.
   */
  | { kind: "descent" };

type EraContextValue = {
  era: Era;
  civilization: number;
  /**
   * The last outcome announced, kept after the notice is dismissed so it can
   * be faded out rather than unmounted mid-sentence. Null only before the
   * first Chaotic Era resolves.
   */
  notice: Notice | null;
  /** Whether that notice should currently be on screen. */
  noticeVisible: boolean;
  stabilised: boolean;
  setStabilised: (value: boolean) => void;
  /** The fleet has left and the simulation is stopped. See DEPARTED_KEY. */
  departed: boolean;
  /**
   * Set on a visit that follows a departure, so the page can say so once. The
   * number is the civilisation the fleet left after.
   */
  returnedAfter: number | null;
  /** Re-form the system from civilisation 1. Also clears the departure. */
  beginAgain: () => void;
  /** Canvas components register here to be drawn each frame. */
  registerRenderer: (fn: Renderer | null) => void;
};

const EraContext = createContext<EraContextValue | null>(null);

export function useEra() {
  const ctx = useContext(EraContext);
  if (!ctx) throw new Error("useEra must be used inside <EraProvider>");
  return ctx;
}

/**
 * Runs the Trisolaran system for the whole site.
 *
 * The simulation is the single source of truth and lives in a ref, so it keeps
 * running across route changes and never re-renders React at 60fps. State is
 * synced out of it inside the frame loop, only when a value actually changes.
 */
export default function EraProvider({ children }: { children: ReactNode }) {
  const [era, setEra] = useState<Era>("stable");
  const [civilization, setCivilization] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [stabilised, setStabilisedState] = useState(false);
  const [departed, setDeparted] = useState(false);
  const [returnedAfter, setReturnedAfter] = useState<number | null>(null);
  const pathname = usePathname();

  const systemRef = useRef<System | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const stabilisedRef = useRef(false);
  // Read inside the frame loop, which must not close over React state.
  const departedRef = useRef(false);
  /**
   * The auto-hide for whichever notice is on screen. In a ref because two
   * effects arm it now — the frame loop for an era's outcome, and the
   * hibernation publish below — and a notice replacing another has to be able
   * to cancel the timer that would otherwise blank it part-way through.
   */
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * The gap this visitor was away, held until there is somewhere to show it.
   *
   * Read once at load, because the act of loading records a new visit and
   * destroys it. Published only when the visitor is on `/`, since that is the
   * only route EraNotice renders on: landing on /projects through a bookmark
   * used to consume the gap into a notice nobody could see, and the message
   * was gone for good.
   */
  const pendingHibernationRef = useRef<{ awayMs: number; civilizations: number } | null>(null);
  /** Whether the descent caption is still owed. See `RISE_NOTICE_MS`. */
  const pendingDescentRef = useRef(false);
  /**
   * That a departure was acknowledged this session, so the descent caption
   * knows to stand down.
   *
   * A ref rather than the `skipHibernation` local it sits beside, because the
   * two have genuinely different lifetimes: that local is per effect run, and
   * whether this visitor has already been told about a departure is per
   * visitor. Reading a departure *consumes* it — DEPARTED_KEY is removed in
   * the same breath — so any second run of the effect asks a question whose
   * evidence the first run has already destroyed, and gets the wrong answer.
   *
   * React's development double-mount is how that surfaced rather than why it
   * is wrong: the second pass found no departure, recomputed `skipHibernation`
   * as false, and re-armed the caption the first pass had correctly
   * suppressed. Measured — the panel came up reading 降维 with the departure
   * acknowledgement already on the page behind it. An effect that only behaves
   * when it runs exactly once is an effect with a latent bug in it, and a ref
   * is the cheapest possible way not to have written one.
   */
  const departureSeenRef = useRef(false);
  /**
   * Whether this visitor has the rise coming, decided during *render*.
   *
   * It cannot wait for an effect. `SystemCanvas` is a child, so its effect —
   * which registers the renderer and draws one frame immediately — runs before
   * this component's effects do. Deciding in the load effect meant that first
   * frame went out at `rise = 1`, and the visitor saw the system fully formed
   * for a frame before it collapsed flat and rose again.
   *
   * A lazy `useState` initialiser runs during render, which is before any
   * child effect, and runs once. On the server it returns false — there is no
   * storage to read and nothing is being drawn — and nothing here reaches the
   * markup, so the two renders cannot disagree about anything the DOM sees.
   */
  const [startFlat] = useState(() => {
    if (typeof window === "undefined") return false;
    // Only where there is a hero to rise. `SystemCanvas` lives in `Hero` and
    // `Hero` renders on `/` alone, so a first-time visitor arriving on a deep
    // link would otherwise spend their one rise on a page with no canvas —
    // the same way landing on /projects used to consume the hibernation gap.
    // The key is claimed below only if the rise actually starts, so arriving
    // at /about costs nothing and the next visit to `/` still gets it.
    if (pathname !== "/") return false;
    // Nor in a tab that is not being looked at. Effects run in hidden tabs and
    // animation frames do not, so a middle-clicked link or a restored session
    // would set the clock, claim the key, and queue the caption against a rAF
    // that fires whenever the visitor gets round to the tab — by which point
    // `now - riseStartRef` is thirty seconds, `t` is 15, and the ramp snaps to
    // 1 on the first painted frame. A fully formed system, a caption
    // describing a rise nobody saw, and the one-shot spent for good.
    //
    // Refusing to start is better than deferring: it is the same rule the
    // deep-link case above settled on, and it costs the visitor nothing. The
    // rise is still theirs on the next visit they actually watch.
    if (document.hidden) return false;
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
      return localStorage.getItem(RISEN_KEY) !== "1";
    } catch {
      // No storage: no rise. The conservative failure for a one-off effect is
      // not playing it, rather than playing it on every single visit.
      return false;
    }
  });
  /** See `Renderer`. In a ref, so advancing it costs no React render. */
  const riseRef = useRef(startFlat ? 0 : 1);
  /** When the rise began, or 0 if it is not running. Wall clock. */
  const riseStartRef = useRef(0);
  /** See `Renderer`. In a ref, so advancing it costs no React render. */
  const hydrationRef = useRef(1);

  const registerRenderer = useCallback((fn: Renderer | null) => {
    rendererRef.current = fn;
    // Draw immediately so a newly mounted canvas isn't blank until the next
    // frame — which matters when the simulation is paused for reduced motion.
    if (fn && systemRef.current) fn(systemRef.current, hydrationRef.current, riseRef.current);
  }, []);

  const setStabilised = useCallback((value: boolean) => {
    stabilisedRef.current = value;
    setStabilisedState(value);
    try {
      localStorage.setItem(STABILISED_KEY, value ? "1" : "0");
    } catch {
      // Storage can be unavailable; the toggle still works for this session.
    }
  }, []);

  /**
   * Re-form the system from civilisation 1.
   *
   * The counter resets with it: the ending is the end of a history, and
   * beginning again starts a new one rather than resuming the old one two
   * civilisations from its ending. The system is rebuilt rather than nudged,
   * because every settle in `advance` starts from a running system and there
   * is nothing here to settle *from* — the last one left.
   */
  const beginAgain = useCallback(() => {
    departedRef.current = false;
    setDeparted(false);
    setReturnedAfter(null);
    setNotice(null);
    setNoticeVisible(false);
    const system = createSystem(1);
    system.pinned = stabilisedRef.current;
    systemRef.current = system;
    setCivilization(1);
    setEra(system.era);
    try {
      localStorage.setItem(CIVILIZATION_KEY, "1");
      localStorage.removeItem(DEPARTED_KEY);
    } catch {
      // Nothing to clear if there was nothing to store.
    }
    rendererRef.current?.(system, hydrationRef.current, riseRef.current);
  }, []);

  /**
   * Record that this visitor was here, in its own effect.
   *
   * Deliberately not inside the simulation effect, which returns early under
   * reduced motion — before any of this was registered and without a cleanup.
   * A reduced-motion visitor therefore wrote `lastSeen` exactly once, on load,
   * and every later visit measured its absence from the *start of the previous
   * session*: forty minutes of reading and a five-minute break was announced
   * as a forty-five minute hibernation. Whether someone was here has nothing
   * to do with whether the suns are moving, and it no longer shares a lifetime
   * with them.
   */
  useEffect(() => {
    const remember = () => {
      try {
        localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
      } catch {
        // Nothing to remember with.
      }
    };
    let beat: ReturnType<typeof setInterval> | undefined;
    const stopBeat = () => {
      clearInterval(beat);
      beat = undefined;
    };
    const startBeat = () => {
      stopBeat();
      beat = setInterval(remember, PRESENCE_BEAT_MS);
    };
    const onPresence = () => {
      remember();
      if (document.hidden) stopBeat();
      else startBeat();
    };
    if (!document.hidden) startBeat();
    document.addEventListener("visibilitychange", onPresence);
    window.addEventListener("pagehide", remember);
    return () => {
      stopBeat();
      document.removeEventListener("visibilitychange", onPresence);
      window.removeEventListener("pagehide", remember);
      remember();
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Restore this visitor's own history *before* building the system. The
    // orbit is chosen from the civilisation number, so assigning the number
    // afterwards moved the counter and left the orbit on civilisation 1's
    // solution — a returning visitor on an even civilisation was shown the odd
    // civilisations' figure-eight, and the offset then persisted through every
    // collapse after it. Floored because this comes back from storage, where
    // anything can be written, and a fractional civilisation indexes no orbit.
    let saved = 1;
    let pinned = false;
    let skipHibernation = false;
    try {
      const raw = Number(localStorage.getItem(CIVILIZATION_KEY));
      if (Number.isFinite(raw) && raw >= 1) saved = Math.floor(raw);
      pinned = localStorage.getItem(STABILISED_KEY) === "1";
    } catch {
      // No storage: start from civilisation 1, unpinned.
    }
    stabilisedRef.current = pinned;

    // A visit after a departure starts the system over rather than resuming a
    // dead one, and says so once. Read and cleared in the same breath: the
    // acknowledgement is for the visit that follows the ending, not for every
    // visit thereafter.
    try {
      const departedAt = Number(localStorage.getItem(DEPARTED_KEY));
      if (Number.isFinite(departedAt) && departedAt >= 1) {
        // Published on a microtask rather than synchronously — the lint rule
        // against cascading renders is right — and deliberately not through
        // the frame loop like the other synced values. The loop does not run
        // for a visitor who prefers reduced motion, or one whose tab is
        // hidden at load, and this is a one-shot message that must survive
        // both. Measured the hard way: driven in a hidden tab it never
        // appeared at all.
        const departedFrom = Math.floor(departedAt);
        queueMicrotask(() => setReturnedAfter(departedFrom));
        saved = 1;
        localStorage.removeItem(DEPARTED_KEY);
        localStorage.setItem(CIVILIZATION_KEY, "1");
        // A departure already has something to say to this visitor, so the
        // hibernation notice stands down for the visit. Two one-shot
        // messages about what someone missed, stacked on one load, read as a
        // changelog rather than as either of the things they are — and the
        // departure is the rarer and more specific of the two.
        skipHibernation = true;
        departureSeenRef.current = true;
      }
    } catch {
      // No storage: there was no departure to come back from either.
    }

    // The rise runs once in a visitor's life. Whether it is coming was decided
    // during render — see `startFlat` — so all that is left here is to start
    // its clock, claim it, and queue the caption.
    if (startFlat) {
      riseStartRef.current = performance.now();
      // Claimed only now that it is being spent. Under reduced motion, on any
      // route without a hero, and in a tab nobody is looking at, `startFlat` is
      // false and nothing is claimed — so the same person still meets the rise
      // on a later visit that can actually show it. Not claiming up front is
      // the whole point: a one-shot marked as used without being seen is a
      // one-shot nobody ever gets.
      try {
        localStorage.setItem(RISEN_KEY, "1");
      } catch {
        // Nothing to claim it with; it will simply run again next time.
      }
      // Captioned from the route effect below, unless a departure already has
      // the panel — see `departureSeenRef`, which is what that question is
      // asked through rather than `returnedAfter`. That state is published on
      // a microtask and is still null at this point, so guarding on it would
      // have suppressed nothing at all.
      pendingDescentRef.current = !departureSeenRef.current;
    }

    // How long they were away, and what to say about it. Published on a
    // microtask rather than through the frame loop, for the reason the
    // departure acknowledgement is: the loop does not run for a visitor who
    // prefers reduced motion, or one whose tab is hidden at load, and this
    // is a one-shot message that has to survive both.
    try {
      const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY));
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
      const awayMs = Number.isFinite(lastSeen) && lastSeen > 0 ? Date.now() - lastSeen : 0;
      // Not while the era shifts are switched off. `pinned` is this visitor
      // saying they want the Chaotic Eras to stop, and the simulation obeys:
      // it re-seeds a Stable Era for as long as the toggle is held and never
      // enters a Chaotic one, so no civilisation can fall. Telling them that
      // 26,928 of them did is not the same contradiction as the counter being
      // smaller than the estimate — it describes events their own persisted
      // setting guarantees did not happen.
      if (!skipHibernation && !pinned && awayMs >= HIBERNATION_MIN_MS) {
        const civilizations = Math.round((awayMs / 3600000) * CIVILIZATIONS_PER_HOUR);
        pendingHibernationRef.current = { awayMs, civilizations };
      }
    } catch {
      // No storage: no gap to measure, and nothing to say about it.
    }

    // Applied to the system rather than to React state, so the server and
    // first client render stay identical and the value reaches the UI through
    // the normal sync below.
    const system = createSystem(saved);
    system.pinned = pinned;
    systemRef.current = system;

    // Push the restored values out on a microtask rather than a frame. A page
    // opened in a background tab gets no animation frames at all, so anything
    // waiting on rAF would leave the UI showing defaults until it was focused.
    queueMicrotask(() => {
      setCivilization(system.civilization);
      setStabilisedState(pinned);
    });

    // Reduced motion: hold one Stable Era permanently. The suns are advanced
    // far enough to trace the figure-eight, then drawn once and left alone.
    if (reduced) {
      advance(system, 380);
      system.era = "stable";
      system.eraElapsed = 0;
      // No rise, for the same reason there is no orbit: a still frame of a
      // flattened system is not a picture of anything.
      //
      // This is the entire render path for a reduced-motion visitor, and
      // nothing downstream covers it. `SystemCanvas` is a descendant, so its
      // effect runs first and calls `registerRenderer` while `systemRef` is
      // still null, which guards out the draw there; the frame loop below is
      // never reached; and `onResize` recomputes dimensions without
      // repainting. Deleting this line leaves a blank hero, and no check in
      // the repo can see it — React's development double-mount hides it by
      // registering a second time after `systemRef` is populated, so it draws
      // in development and not in production.
      rendererRef.current?.(system, 1, 1);
      return;
    }

    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let running = true;
    // When the running rehydration began, or 0 if none is. Wall-clock, because
    // this is an animation the visitor watches rather than anything the
    // simulation measures — and because no simulation time passes while the
    // tab is hidden, which is the whole point of the pause.
    let hydrationStart = 0;
    let hiddenAt = 0;

    // Mirrors of the last values pushed into React, so we only setState on a
    // genuine change rather than every frame.
    let lastEra: Era = system.era;
    let lastHeat = -1;
    let lastCivilization = system.civilization;
    let lastStabilised = pinned;
    // Which system the mirrors above describe. `beginAgain` swaps in a new one.
    let lastSystem = system;

    const tick = (now: number) => {
      // Read the system from the ref every frame rather than closing over the
      // one built here. `beginAgain` puts a *new* system in the ref, and a
      // loop still holding the old one simply repainted it on the next frame:
      // the replacement was drawn once and then discarded, so the ending had
      // no working way out of it — the counter said #1 while a departed
      // system carried on underneath, still red, still unbound.
      const sys = systemRef.current;
      if (!sys) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // A swap invalidates every mirror below, which exists to avoid
      // publishing a value that has not changed. Left alone they describe the
      // system that is gone, and no correction is ever pushed.
      if (sys !== lastSystem) {
        lastSystem = sys;
        lastEra = sys.era;
        lastCivilization = sys.civilization;
        lastStabilised = stabilisedRef.current;
        lastHeat = -1;
      }
      if (!running) return;

      const delta = Math.min((now - last) / 1000, MAX_CATCHUP);
      last = now;
      accumulator += delta;

      const frames = Math.floor(accumulator * SIM_HZ);
      accumulator -= frames / SIM_HZ;

      // Honoured inside the simulation, which re-anchors the suns onto the
      // periodic solution rather than perturbing them. Forcing era and
      // eraElapsed from out here instead only stopped the *clock*: the suns
      // kept drifting, and the worlds went on dying under a Stable Era label.
      sys.pinned = stabilisedRef.current;


      for (let i = 0; i < frames; i++) {
        for (const event of advance(sys, 1)) {
          // The batch can be up to MAX_CATCHUP long, so a departure at frame
          // 5 of 30 used to leave 25 more to run: the era resolved, a
          // collapse notice landed on top of the departure panel, and the
          // counter wrote a civilisation the ending had already ruled out.
          if (departedRef.current) break;
          // Dismissing clears `noticeVisible` and leaves `notice` standing, so
          // the panel has text to fade out with. Clearing the notice itself
          // unmounted the text in the same commit that started the wrapper's
          // 700ms fade, and it cut out mid-sentence.
          if (event.type === "collapse") {
            const destroyed = event.civilization;
            setNotice({ kind: "collapse", civilization: destroyed, cause: event.cause });
            setNoticeVisible(true);
            try {
              localStorage.setItem(CIVILIZATION_KEY, String(destroyed + 1));
            } catch {
              // Non-persistent visitors simply restart at 1 next time.
            }
            clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = setTimeout(() => setNoticeVisible(false), COLLAPSE_NOTICE_MS);
          } else if (event.type === "lost") {
            // The planet itself, not a civilisation. Below the gate this is
            // the worst thing that has ever happened and is lived through;
            // the simulation carries on and the era resolves as it would
            // have. Above it, the fleet leaves.
            if (event.civilization >= DEPARTURE_AT && !departedRef.current) {
              departedRef.current = true;
              sys.departed = true;
              setDeparted(true);
              setNoticeVisible(false);
              try {
                localStorage.setItem(DEPARTED_KEY, String(event.civilization));
              } catch {
                // Without storage the ending is simply not remembered.
              }
            }
          } else if (event.type === "survived") {
            setNotice({ kind: "survived", civilization: event.civilization });
            setNoticeVisible(true);
            clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = setTimeout(() => setNoticeVisible(false), SURVIVAL_NOTICE_MS);
          }
        }
      }

      if (sys.era !== lastEra) {
        lastEra = sys.era;
        setEra(sys.era);
      }

      // Rehydration, if one is running. Everything downstream reads it, so
      // advancing it here — after the simulation has stepped and before
      // anything is published — keeps the page and the canvas on the same
      // value within a frame.
      if (hydrationStart) {
        const t = (now - hydrationStart) / REHYDRATION_MS;
        if (t >= 1) {
          hydrationStart = 0;
          hydrationRef.current = 1;
        } else {
          // The same smoothstep the canvas eases its framing with.
          hydrationRef.current = t * t * (3 - 2 * t);
        }
      }

      // The system coming out of the flat page. Same shape as the ramp above,
      // same smoothstep, and it runs exactly once in a visitor's life.
      if (riseStartRef.current) {
        const t = (now - riseStartRef.current) / RISE_MS;
        if (t >= 1) {
          riseStartRef.current = 0;
          riseRef.current = 1;
        } else {
          riseRef.current = t * t * (3 - 2 * t);
        }
      }

      // Publish heat to CSS. Quantised to 1%, so a full fade costs at most a
      // hundred style recalculations rather than one per frame. Scaled by
      // rehydration so a returning visitor warms back up to the era they left
      // rather than being dropped into it — and scaled here, at the one place
      // heat reaches the page, so the canvas cannot disagree with the palette.
      const heat = Math.round(sys.heat * hydrationRef.current * 100) / 100;
      if (heat !== lastHeat) {
        lastHeat = heat;
        document.documentElement.style.setProperty("--heat", String(heat));
      }
      if (sys.civilization !== lastCivilization) {
        lastCivilization = sys.civilization;
        setCivilization(sys.civilization);
      }
      if (stabilisedRef.current !== lastStabilised) {
        lastStabilised = stabilisedRef.current;
        setStabilisedState(stabilisedRef.current);
      }

      rendererRef.current?.(sys, hydrationRef.current, riseRef.current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    // 脱水. A hidden tab is not painted, so drying out is free: stop, and let
    // the water go. It is the return that costs anything, and only after an
    // absence long enough to have been worth surviving.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
        hiddenAt = performance.now();
        return;
      }

      if (running) return;

      running = true;
      const now = performance.now();
      const away = now - hiddenAt;
      last = now;
      accumulator = 0;

      if (away > DEHYDRATION_MS) {
        // Unfurl. Starting from 0 is what makes the first frame back dry —
        // empty trails, no worlds, no heat — rather than the era the visitor
        // walked away from, resumed mid-sentence.
        hydrationStart = now;
        hydrationRef.current = 0;
      } else if (hydrationStart) {
        // Hidden again part-way through a return. Push the transition on by
        // the time away rather than restarting it or snapping to full, either
        // of which is a jump the visitor did nothing to earn.
        hydrationStart += away;
      }

      // The rise gets the same treatment, and for a sharper reason: it runs
      // once in a visitor's life, so a snap to 1 is not a jump they can watch
      // again. Both clocks are wall-clock, and neither should count time spent
      // in a tab nobody was looking at.
      if (riseStartRef.current) riseStartRef.current += away;

      frame = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      clearTimeout(noticeTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `startFlat` comes from a lazy initialiser and never changes, so this stays
    // a mount-once effect; it is listed because the effect reads it.
    //
    // Listed rather than disabled, because it is a real dependency and saying
    // so is honest. But it is load-bearing: this effect builds the system,
    // owns the frame loop and reads every storage key, so anything that ever
    // made `startFlat` reactive would tear all of that down and rebuild it to
    // change one render ramp. The invariant that keeps this safe is the lazy
    // initialiser, not the array.
  }, [startFlat]);

  /**
   * Show the hibernation gap once the visitor is on the route that can render
   * it. Runs on mount as well as on navigation, so someone who lands on `/`
   * sees it immediately and someone who arrives at /about sees it when they
   * get home.
   *
   * On a microtask, like every other one-shot here: this must reach a visitor
   * who prefers reduced motion and one whose tab is hidden at load, and
   * neither of them gets an animation frame.
   */
  useEffect(() => {
    if (pathname !== "/") return;
    const pending = pendingHibernationRef.current;
    if (!pending) {
      // The descent caption, which loses to both of the others.
      //
      // By construction it cannot collide with either: a hibernation needs a
      // previous visit to have written `lastSeen`, and a departure needs one
      // to have reached DEPARTURE_AT, and neither is true of a visitor who
      // has never been here. That is an argument, not a guarantee — storage
      // can be cleared a key at a time — so the precedence is written down
      // rather than assumed. It goes this way round because the other two
      // are the only account anyone gets of something they missed, while
      // this one is a label for a thing happening in front of them.
      if (!pendingDescentRef.current) return;
      pendingDescentRef.current = false;
      queueMicrotask(() => {
        setNotice({ kind: "descent" });
        setNoticeVisible(true);
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => setNoticeVisible(false), RISE_NOTICE_MS);
      });
      return;
    }
    pendingDescentRef.current = false;
    pendingHibernationRef.current = null;
    queueMicrotask(() => {
      setNotice({ kind: "hibernation", ...pending });
      setNoticeVisible(true);
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setNoticeVisible(false), HIBERNATION_NOTICE_MS);
    });
  }, [pathname]);

  // Exposed for anything that wants the discrete state. The palette does not
  // use it — colour is driven continuously by --heat instead.
  useEffect(() => {
    document.documentElement.dataset.era = era;
    return () => {
      delete document.documentElement.dataset.era;
    };
  }, [era]);

  // --heat belongs to the provider's lifetime, not to any one era. The frame
  // loop owns it and republishes only when the 1%-quantised value changes, so
  // removing it on every era *change* left the page rendering at the
  // @property initial-value of 0 — fully cold — until heat next crossed a 1%
  // step. At a collapse heat is 0.98, so that was a full red-to-black flash.
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--heat");
    };
  }, []);

  return (
    <EraContext.Provider
      value={{
        era,
        civilization,
        notice,
        noticeVisible,
        stabilised,
        setStabilised,
        departed,
        returnedAfter,
        beginAgain,
        registerRenderer,
      }}
    >
      {children}
    </EraContext.Provider>
  );
}
