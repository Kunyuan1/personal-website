import type { Metadata } from "next";
import Link from "next/link";

import SophonCanvas from "@/components/SophonCanvas";
import { site } from "@/data/site";

const NOTHING_HERE = "There is nothing at this address.";

/**
 * Metadata merges per *top-level key*, not per field.
 *
 * So overriding `description` alone left the layout's `openGraph.description`
 * standing, and a dead link pasted into Slack unfurled as a 404 over a blurb
 * advertising real-time systems and game projects. But replacing `openGraph`
 * and `twitter` with two fields each was the same mistake from the other
 * side: it dropped `og:type` — which the spec requires — along with the URL,
 * the site name and the locale, and silently downgraded the Twitter card to
 * `summary`, because Next defaults it when `card` is unset.
 *
 * Every field either object is meant to carry is therefore restated here.
 *
 * `robots` too: Next injects `noindex` for a 404 response, and without this
 * the layout's `index, follow` came along beside it, leaving two contradictory
 * robots tags in one head. Crawlers take the most restrictive reading, so
 * nothing broke — but a contradiction is not a decision.
 */
export const metadata: Metadata = {
  title: "404",
  description: NOTHING_HERE,
  openGraph: {
    type: "website",
    locale: "en_CA",
    // Relative: the root layout sets `metadataBase`, so Next resolves it and
    // there is no second copy of the site URL to drift.
    url: "/404",
    siteName: site.name,
    title: `404 — ${site.name}`,
    description: NOTHING_HERE,
  },
  twitter: {
    card: "summary_large_image",
    title: `404 — ${site.name}`,
    description: NOTHING_HERE,
  },
  robots: { index: false, follow: true },
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
    // One screen, with nothing to scroll to.
    //
    // `min-h` is a floor, not a cap: at 68svh it only ever *grew* the block on
    // tall screens and did nothing on short ones, so the page still overflowed
    // by 137px on a 1366x640 laptop and 126px on a 375x667 phone — it simply
    // happened to fit the one size it was checked at. What decides this is the
    // fixed height of the content, so the canvas and the padding are sized
    // from the viewport instead.
    <div className="flex min-h-[60svh] flex-col items-center justify-center px-6 py-[clamp(1.5rem,4svh,4rem)]">
      {/* Above the words rather than behind them: the etched surface is a field
          of thin lines, and laid under the copy it turns every sentence into
          something you have to pick out of a grid. */}
      {/* clamp, not min: a bare min() collapses to nothing anywhere svh resolves
          to 0 — an embedded or zero-height context — and the canvas simply
          vanishes. The floor keeps an object on the page whatever the unit does,
          and the ceiling is the size it wants on a roomy screen. */}
      <SophonCanvas className="pointer-events-none h-[clamp(8rem,26svh,13rem)] w-[clamp(8rem,26svh,13rem)] sm:h-[clamp(9rem,30svh,16rem)] sm:w-[clamp(9rem,30svh,16rem)]" />

      <div className="mt-[clamp(1.5rem,4svh,3rem)] max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          <span className="cjk mr-2 normal-case tracking-normal">智子</span>
          404
        </p>

        <h1 className="mt-6 text-2xl text-ink">Something got here first.</h1>

        <p className="mt-3 text-sm text-muted">{NOTHING_HERE}</p>

        <Link
          href="/"
          className="mt-[clamp(1.5rem,3svh,2.5rem)] inline-block border border-line px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-faint transition-colors hover:border-accent hover:text-ink"
        >
          Return to the system
        </Link>
      </div>
    </div>
  );
}
