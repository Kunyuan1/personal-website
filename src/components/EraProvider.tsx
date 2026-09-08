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
/** How long the return from one takes. */
const REHYDRATION_MS = 900;

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
  /**
   * True from the moment the hidden tab has been away long enough to have
   * dried out, until the return finishes. Named for what the Trisolarans do
   * to survive a Chaotic Era: expel every drop of water, and wait.
   */
  dehydrated: boolean;
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
  const [dehydrated, setDehydrated] = useState(false);

  const systemRef = useRef<System | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const stabilisedRef = useRef(false);
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
    let dryTimer: ReturnType<typeof setTimeout> | undefined;

    // Mirrors of the last values pushed into React, so we only setState on a
    // genuine change rather than every frame.
    let lastEra: Era = system.era;
    let lastHeat = -1;
    let lastCivilization = system.civilization;
    let lastStabilised = pinned;

    const tick = (now: number) => {
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
      system.pinned = stabilisedRef.current;

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
          setDehydrated(false);
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
        // Marked from inside the absence rather than on the way out of it, so
        // the footer's reading is true while it is true. Timers are throttled
        // in a hidden tab but not stopped, and a second of slop against five
        // does not matter.
        dryTimer = setTimeout(() => setDehydrated(true), DEHYDRATION_MS);
        return;
      }

      clearTimeout(dryTimer);
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
        setDehydrated(true);
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
      clearTimeout(dryTimer);
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
        dehydrated,
        registerRenderer,
      }}
    >
      {children}
    </EraContext.Provider>
  );
}
