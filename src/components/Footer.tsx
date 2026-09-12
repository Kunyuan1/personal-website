"use client";

import { useEra } from "@/components/EraProvider";
import { site } from "@/data/site";

export default function Footer() {
  const { stabilised, setStabilised, civilization, departed, returnedAfter, beginAgain } =
    useEra();

  return (
    <footer className="relative z-10 border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-faint">
            © {new Date().getFullYear()} {site.name}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="font-mono text-xs text-faint">
              <span className="cjk">文明</span>
              <span className="ml-2 uppercase tracking-[0.16em]">Civilization</span>{" "}
              #{civilization}
            </p>

            {/* Anyone who finds the era shifts distracting can switch them off,
                and the choice is remembered. */}
            <button
              type="button"
              onClick={() => setStabilised(!stabilised)}
              aria-pressed={stabilised}
              className="font-mono text-xs text-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {stabilised ? "Allow Chaotic Eras" : "Hold Stable Era"}
            </button>

            {/* The way back from the ending. Rendered only when there is one
                to come back from — a reset for a system that is running fine
                is an invitation to wipe a history someone spent an hour on. */}
            {departed ? (
              <button
                type="button"
                onClick={beginAgain}
                className="font-mono text-xs text-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Begin again
              </button>
            ) : null}

            {/* Said once, on the visit after the fleet left. */}
            {returnedAfter !== null ? (
              <p className="font-mono text-xs text-faint/70">
                Fleet departed after #{returnedAfter} · system re-formed
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
