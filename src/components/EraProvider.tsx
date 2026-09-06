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

type Renderer = (system: System) => void;

type EraContextValue = {
  era: Era;
  civilization: number;
  /** Set for a few seconds after a civilisation is destroyed. */
  collapse: { civilization: number; cause: CollapseCause } | null;
  stabilised: boolean;
  setStabilised: (value: boolean) => void;
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
  const [collapse, setCollapse] = useState<{
    civilization: number;
    cause: CollapseCause;
  } | null>(null);
  const [stabilised, setStabilisedState] = useState(false);

  const systemRef = useRef<System | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const stabilisedRef = useRef(false);

  const registerRenderer = useCallback((fn: Renderer | null) => {
    rendererRef.current = fn;
    // Draw immediately so a newly mounted canvas isn't blank until the next
    // frame — which matters when the simulation is paused for reduced motion.
    if (fn && systemRef.current) fn(systemRef.current);
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
      rendererRef.current?.(system);
      return;
    }

    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let running = true;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;

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
          if (event.type !== "collapse") continue;
          const destroyed = event.civilization;
          setCollapse({ civilization: destroyed, cause: event.cause });
          try {
            localStorage.setItem(CIVILIZATION_KEY, String(destroyed + 1));
          } catch {
            // Non-persistent visitors simply restart at 1 next time.
          }
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => setCollapse(null), COLLAPSE_NOTICE_MS);
        }
      }

      if (system.era !== lastEra) {
        lastEra = system.era;
        setEra(system.era);
      }

      // Publish heat to CSS. Quantised to 1%, so a full fade costs at most a
      // hundred style recalculations rather than one per frame.
      const heat = Math.round(system.heat * 100) / 100;
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

      rendererRef.current?.(system);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        last = performance.now();
        accumulator = 0;
        frame = requestAnimationFrame(tick);
      }
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
        collapse,
        stabilised,
        setStabilised,
        registerRenderer,
      }}
    >
      {children}
    </EraContext.Provider>
  );
}
