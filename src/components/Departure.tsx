"use client";

import { usePathname } from "next/navigation";

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
 * Trisolaris about once every seventeen minutes of watching, and `EraProvider`
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
  const pathname = usePathname();

  // The panel describes the system in the hero, and only `/` renders Hero — the
  // same reason EraNotice bails here. Elsewhere it was a card explaining the
  // loss of a planet that is nowhere on screen, laid over the résumé, and its
  // own `pointer-events-auto` swallowed clicks through the middle of every
  // subpage.
  if (pathname !== "/") return null;

  // The live region is mounted whether or not there is anything in it. A region
  // that appears at the same moment as its content is generally not announced —
  // screen readers watch for mutations inside regions they already know about —
  // so gating the whole thing on `departed` meant the ending was announced to
  // nobody, and the only hint was a new button in the focus order. EraNotice
  // already does it this way.
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6 transition-opacity duration-700 ${
        departed ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      {departed && (
        <div className="pointer-events-auto max-w-lg rounded-lg border border-line bg-void/90 px-7 py-6 backdrop-blur-sm">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-faint">
            <span className="cjk mr-2 normal-case tracking-normal">舰队</span>
            The fleet departs
          </p>

          <p className="mt-4 text-sm leading-relaxed text-ink">
            Trisolaris came loose from its suns and did not come back. There was
            no orbit left to hold, and no next civilization to count — so the
            last one did the only thing left to do, and left.
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
      )}
    </div>
  );
}
