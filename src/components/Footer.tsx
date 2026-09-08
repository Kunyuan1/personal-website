"use client";

import { useEra } from "@/components/EraProvider";
import { site } from "@/data/site";

export default function Footer() {
  const { stabilised, setStabilised, civilization } = useEra();

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

            {/* 不要回答 — the warning sent back across four light years. */}
            <p
              className="font-mono text-xs text-faint/70"
              title="Do not answer. Do not answer. Do not answer."
            >
              <span className="cjk">不要回答</span>
              <span className="mx-2 text-line-bright">·</span>
              Do not answer
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
