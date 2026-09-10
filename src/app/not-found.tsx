import Link from "next/link";

import DropletCanvas from "@/components/DropletCanvas";

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
 * A droplet, alone, reflecting three suns that are not on screen — because the
 * system it came from is not here either, which is the same thing this page is
 * telling you about the address you asked for.
 *
 * "It came in peace" is what the fleet's own message said, and what the crowds
 * at the gathering believed while the thing they were cheering flew the length
 * of their formation and took it apart. It is the most disarming sentence in
 * the books and it belongs on a page that is telling you, gently, that you have
 * gone somewhere that does not exist.
 *
 * The page is server-rendered; only the canvas is a client island, so `/404`
 * stays a static route.
 */
export default function NotFound() {
  return (
    // Sized to leave room for the nav above and the footer below, so the page
    // is one screen with nothing to scroll to. `100svh - 4rem` is the hero's
    // measurement, where overflowing is the point because there is a page
    // underneath; here there is not.
    <div className="flex min-h-[68svh] flex-col items-center justify-center px-6 py-16">
      {/* Above the words, not behind them. Laid over the copy, the three
          highlights land on whatever sentence happens to be under them and both
          the object and the text stop being legible. */}
      <DropletCanvas className="pointer-events-none h-52 w-52 sm:h-64 sm:w-64" />

      <div className="mt-12 max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          <span className="cjk mr-2 normal-case tracking-normal">水滴</span>
          404
        </p>

        <h1 className="mt-6 text-2xl text-ink">It came in peace.</h1>

        <p className="mt-3 text-sm text-muted">There is nothing at this address.</p>

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
