import Link from "next/link";

import SophonCanvas from "@/components/SophonCanvas";

const NOTHING_HERE = "There is nothing at this address.";

export const metadata = {
  title: "404",
  description: NOTHING_HERE,
  // The root layout sets `openGraph.description` and `twitter.description`
  // absolutely, and metadata merges per key — so without these a dead link
  // pasted into Slack unfurled as "404 — Kunyuan Hu" over a blurb advertising
  // real-time systems and game projects.
  openGraph: { title: "404 — Kunyuan Hu", description: NOTHING_HERE },
  twitter: { title: "404 — Kunyuan Hu", description: NOTHING_HERE },
};

/**
 * The page that isn't there.
 *
 * A sophon, because a 404 is a locked door rather than a disaster. The
 * Trisolarans did not send a weapon first — they sent two unfolded protons to
 * sit inside our accelerators and make the results lie, so that every
 * experiment came back nonsense and physics stopped moving. Not destruction: a
 * guarantee that you will not find what you are looking for, however many times
 * you ask.
 *
 * Which is what this page is. "Something got here first" is true of a sophon
 * and true of a dead URL, and a visitor who has never read the books still gets
 * a straight answer on the line below it.
 *
 * The page is server-rendered; only the canvas is a client island, so
 * `/_not-found` stays a static route.
 */
export default function NotFound() {
  return (
    // Sized to leave room for the nav above and the footer below, so the page
    // is one screen with nothing to scroll to. `100svh - 4rem` is the hero's
    // measurement, where overflowing is the point because there is a page
    // underneath; here there is not.
    <div className="flex min-h-[68svh] flex-col items-center justify-center px-6 py-16">
      {/* Above the words rather than behind them: the etched surface is a field
          of thin lines, and laid under the copy it turns every sentence into
          something you have to pick out of a grid. */}
      <SophonCanvas className="pointer-events-none h-52 w-52 sm:h-64 sm:w-64" />

      <div className="mt-12 max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          <span className="cjk mr-2 normal-case tracking-normal">智子</span>
          404
        </p>

        <h1 className="mt-6 text-2xl text-ink">Something got here first.</h1>

        <p className="mt-3 text-sm text-muted">{NOTHING_HERE}</p>

        <Link
          href="/"
          className="mt-10 inline-block border border-line px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-faint transition-colors hover:border-accent hover:text-ink"
        >
          Return to the system
        </Link>
      </div>
    </div>
  );
}
