"use client";

import { useEra } from "@/components/EraProvider";

/**
 * The end of the system, and the way back from it.
 *
 * Every other notice on this site is about a civilisation: something ends, the
 * counter turns over, and the world goes on without the people who were
 * standing on it. This is the other one. The planet itself comes unbound from
 * the three suns and leaves, and there is no civilisation N+1 to announce
 * because there is nowhere left to stand.
 *
 * It is deliberately hard to reach. The simulation reports an unbound
 * Trisolaris about once every nineteen minutes of watching, and `EraProvider`
 * ignores it until fifty civilisations have already come and gone — roughly
 * half an hour of cumulative visiting. Below that gate the same event is a
 * catastrophe survived: the world is flung out, hauled back, and the era
 * resolves however it was going to.
 *
 * The way back is in the footer, beside the era toggle, because that is where
 * this site keeps the controls a visitor is allowed over the simulation. It is
 * repeated here because this panel covers the hero, and an ending with no
 * visible exit is a worse thing to do to a portfolio page than an ending.
 */
export default function Departure() {
  const { departed, beginAgain } = useEra();
  if (!departed) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-w-lg rounded-lg border border-line bg-void/90 px-7 py-6 backdrop-blur-sm">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-faint">
          <span className="cjk mr-2 normal-case tracking-normal">舰队</span>
          The fleet departs
        </p>

        <p className="mt-4 text-sm leading-relaxed text-ink">
          Trisolaris came loose from its suns and did not come back. There was no
          orbit left to hold, and no next civilization to count — so the last one
          did the only thing left to do, and left.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-faint">
          The three suns go on without it, as they did before anyone arrived.
        </p>

        <button
          type="button"
          onClick={beginAgain}
          className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Begin again
        </button>
      </div>
    </div>
  );
}
