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

import { advance, createSystem, SIM_HZ, type Era, type System } from "@/lib/trisolaris";

const CIVILIZATION_KEY = "trisolaris.civilization";
const STABILISED_KEY = "trisolaris.stabilised";
/** Most simulation time a single animation frame may catch up on, in seconds. */
const MAX_CATCHUP = 0.5;
/** How long the collapse notice stays on screen. */
const COLLAPSE_NOTICE_MS = 5200;

type Renderer = (system: System) => void;

type EraContextValue = {
  era: Era;
  civilization: number;
  /** Set for a few seconds after a civilisation is destroyed. */
  collapsedCivilization: number | null;
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
  const [collapsedCivilization, setCollapsedCivilization] = useState<number | null>(null);
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

    const system = createSystem(1);
    systemRef.current = system;

    // Restore this visitor's own history. Applied to the system rather than to
    // React state, so the server and first client render stay identical and
    // the value reaches the UI through the normal sync below.
    let pinned = false;
    try {
      const saved = Number(localStorage.getItem(CIVILIZATION_KEY));
      if (Number.isFinite(saved) && saved >= 1) system.civilization = saved;
      pinned = localStorage.getItem(STABILISED_KEY) === "1";
    } catch {
      // No storage: start from civilisation 1, unpinned.
    }
    stabilisedRef.current = pinned;

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
    let lastCivilization = system.civilization;
    let lastStabilised = pinned;

    const tick = (now: number) => {
      if (!running) return;

      const delta = Math.min((now - last) / 1000, MAX_CATCHUP);
      last = now;
      accumulator += delta;

      const frames = Math.floor(accumulator * SIM_HZ);
      accumulator -= frames / SIM_HZ;

      for (let i = 0; i < frames; i++) {
        if (stabilisedRef.current) {
          // Pinned: keep integrating so the suns still move, but never let the
          // era clock run far enough to trigger a perturbation.
          advance(system, 1);
          system.era = "stable";
          system.eraElapsed = 0;
          continue;
        }

        for (const event of advance(system, 1)) {
          if (event.type !== "collapse") continue;
          const destroyed = event.civilization;
          setCollapsedCivilization(destroyed);
          try {
            localStorage.setItem(CIVILIZATION_KEY, String(destroyed + 1));
          } catch {
            // Non-persistent visitors simply restart at 1 next time.
          }
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => setCollapsedCivilization(null), COLLAPSE_NOTICE_MS);
        }
      }

      if (system.era !== lastEra) {
        lastEra = system.era;
        setEra(system.era);
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

  // Drive the ambient theme from one attribute on <html>, so every page can
  // respond in CSS without threading state through each component.
  useEffect(() => {
    document.documentElement.dataset.era = era;
    return () => {
      delete document.documentElement.dataset.era;
    };
  }, [era]);

  return (
    <EraContext.Provider
      value={{
        era,
        civilization,
        collapsedCivilization,
        stabilised,
        setStabilised,
        registerRenderer,
      }}
    >
      {children}
    </EraContext.Provider>
  );
}
