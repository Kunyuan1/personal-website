"use client";

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
 * How many civilisations must have come and gone before the simulation losing
 * Trisolaris means the end rather than a catastrophe lived through.
 *
 * Measured, a collapse lands every 35 seconds or so, which puts this about 29
 * minutes of cumulative watching away — spread over as many visits as someone
 * likes, since the counter persists. Past it, the simulation reports the
 * planet unbound about once every 19 minutes.
 *
 * The gate lives here rather than in the simulation because the counter does.
 * `advance` reports what happened to the planet and decides nothing, which is
 * also what makes this trivially testable: set
 * `localStorage["trisolaris.civilization"]` to 50 and wait.
 */
const DEPARTURE_AT = 50;
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
 * Draws the system, and takes rehydration progress along with it: 1 whenever
 * the page is simply running, easing 0 -> 1 on the way back from a
 * dehydration. Passed rather than stored on the system, because it is a
 * rendering concern and the physics must not be able to see it.
 */
type Renderer = (system: System, hydration: number) => void;

/**
 * What just became of the current civilisation. A Chaotic Era resolves one way
 * or the other and both are worth announcing — reporting only the deaths left
 * a survival looking like a notice that had failed to appear.
 */
export type Notice =
  | { kind: "collapse"; civilization: number; cause: CollapseCause }
  | { kind: "survived"; civilization: number };

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

  const systemRef = useRef<System | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const stabilisedRef = useRef(false);
  // Read inside the frame loop, which must not close over React state.
  const departedRef = useRef(false);
  // Published by the frame loop rather than set here, for the same reason the
  // restored civilisation is: an effect body that calls setState synchronously
  // cascades a render before the first paint.
  const returnedAfterRef = useRef<number | null>(null);
  /** See `Renderer`. In a ref, so advancing it costs no React render. */
  const hydrationRef = useRef(1);

  const registerRenderer = useCallback((fn: Renderer | null) => {
    rendererRef.current = fn;
    // Draw immediately so a newly mounted canvas isn't blank until the next
    // frame — which matters when the simulation is paused for reduced motion.
    if (fn && systemRef.current) fn(systemRef.current, hydrationRef.current);
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
    rendererRef.current?.(system, hydrationRef.current);
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
        returnedAfterRef.current = departedFrom;
        queueMicrotask(() => setReturnedAfter(departedFrom));
        saved = 1;
        localStorage.removeItem(DEPARTED_KEY);
        localStorage.setItem(CIVILIZATION_KEY, "1");
      }
    } catch {
      // No storage: there was no departure to come back from either.
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
      rendererRef.current?.(system, 1);
      return;
    }

    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let running = true;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
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
    let lastReturnedAfter: number | null = null;
    let lastStabilised = pinned;

    const tick = (now: number) => {
      if (!running) return;

      const delta = Math.min((now - last) / 1000, MAX_CATCHUP);
      last = now;
      accumulator += delta;

      let frames = Math.floor(accumulator * SIM_HZ);
      accumulator -= frames / SIM_HZ;

      // Honoured inside the simulation, which re-anchors the suns onto the
      // periodic solution rather than perturbing them. Forcing era and
      // eraElapsed from out here instead only stopped the *clock*: the suns
      // kept drifting, and the worlds went on dying under a Stable Era label.
      system.pinned = stabilisedRef.current;

      // Departed: the system is stopped where it ended. The canvas keeps
      // drawing it, so the last configuration stays on screen under the
      // notice rather than the hero going blank.
      if (departedRef.current) frames = 0;

      for (let i = 0; i < frames; i++) {
        for (const event of advance(system, 1)) {
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
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => setNoticeVisible(false), COLLAPSE_NOTICE_MS);
          } else if (event.type === "lost") {
            // The planet itself, not a civilisation. Below the gate this is
            // the worst thing that has ever happened and is lived through;
            // the simulation carries on and the era resolves as it would
            // have. Above it, the fleet leaves.
            if (event.civilization >= DEPARTURE_AT && !departedRef.current) {
              departedRef.current = true;
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
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => setNoticeVisible(false), SURVIVAL_NOTICE_MS);
          }
        }
      }

      if (system.era !== lastEra) {
        lastEra = system.era;
        setEra(system.era);
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

      // Publish heat to CSS. Quantised to 1%, so a full fade costs at most a
      // hundred style recalculations rather than one per frame. Scaled by
      // rehydration so a returning visitor warms back up to the era they left
      // rather than being dropped into it — and scaled here, at the one place
      // heat reaches the page, so the canvas cannot disagree with the palette.
      const heat = Math.round(system.heat * hydrationRef.current * 100) / 100;
      if (heat !== lastHeat) {
        lastHeat = heat;
        document.documentElement.style.setProperty("--heat", String(heat));
      }
      if (system.civilization !== lastCivilization) {
        lastCivilization = system.civilization;
        setCivilization(system.civilization);
      }
      if (returnedAfterRef.current !== lastReturnedAfter) {
        lastReturnedAfter = returnedAfterRef.current;
        setReturnedAfter(lastReturnedAfter);
      }
      if (stabilisedRef.current !== lastStabilised) {
        lastStabilised = stabilisedRef.current;
        setStabilisedState(stabilisedRef.current);
      }

      rendererRef.current?.(system, hydrationRef.current);
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

      frame = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      clearTimeout(noticeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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
