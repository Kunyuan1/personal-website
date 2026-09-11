import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import Departure from "@/components/Departure";
import EraNotice from "@/components/EraNotice";
import EraProvider from "@/components/EraProvider";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { CJK_GLYPHS, site } from "@/data/site";
import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

// TODO(kunyuan): point this at your real domain once Vercel is wired up.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kunyuan.vercel.app";

const description = `${site.role} — ${site.study} at the ${site.school}. Real-time multiplayer, game development, and full-stack projects.`;

/**
 * Google Fonts can subset a CJK face down to just the glyphs we use, which
 * turns a multi-megabyte font into a couple of kilobytes. next/font doesn't
 * expose the `text` parameter, so this one is requested by hand.
 */
const notoSerifSc = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&text=${encodeURIComponent(
  CJK_GLYPHS,
)}&display=swap`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description,
  keywords: [
    site.name,
    "software developer",
    "computer science",
    "statistics",
    "University of Toronto Mississauga",
    "portfolio",
  ],
  authors: [{ name: site.name, url: siteUrl }],
  creator: site.name,
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: siteUrl,
    siteName: site.name,
    title: `${site.name} — ${site.role}`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.role}`,
    description,
  },
  robots: { index: true, follow: true },
};

/**
 * Decides the arrival sequence, before anything is painted.
 *
 * This runs as a blocking script in `<head>`, which is the whole point of it.
 * The page is statically prerendered and arrives fully formed, so a decision
 * taken after hydration shows the finished page first and then drops a black
 * screen over it — the visitor sees a glitch, and not the intended kind.
 * Running here means the overlay is in the style system before `<body>` is
 * parsed, and the first frame anyone sees is already black.
 *
 * It refuses in four cases, each one a case where the sequence would be spent
 * on somebody who cannot see it:
 *
 *  - not on `/`, because arriving at a deep link is not an arrival
 *  - in a hidden tab, because a middle-clicked link gets no paint and no
 *    animation, and would burn the one-shot in the background
 *  - under `prefers-reduced-motion`, where the key is deliberately *not*
 *    claimed: the setting asks not to be shown an animation, not to be struck
 *    off the list of people who have never seen one
 *  - if this browser has already seen it
 *
 * `?intro=1` replays it regardless. Not a debug hook left in by accident: a
 * once-per-lifetime sequence that cannot be replayed is one nobody can judge,
 * and the alternative is clearing site storage by hand every time. It
 * overrides the seen-already check and nothing else.
 *
 * It touches nothing React owns — one data attribute on the document element —
 * so there is no hydration mismatch to worry about, and nothing to tear down:
 * the CSS ends with the overlay `visibility: hidden` and inert.
 */
const introScript = `(function(){try{
var d=document.documentElement;
if(location.pathname!=="/")return;
if(document.hidden)return;
if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
if(location.search.indexOf("intro=1")<0&&localStorage.getItem("trisolaris.intro")==="1")return;
localStorage.setItem("trisolaris.intro","1");
d.dataset.intro="on";
}catch(e){}})();`;

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={notoSerifSc} />
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-void text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-void"
        >
          Skip to content
        </a>

        <EraProvider>
          <div className="era-wash" aria-hidden />
          <Nav />
          <main id="main" className="relative z-10 flex-1">
            {children}
          </main>
          <Footer />
          <EraNotice />
          <Departure />
        </EraProvider>

        {/* The arrival sequence. An overlay rather than anything done to the
            page: the document underneath is never transformed, so the
            simulation sizes itself correctly and is already running by the
            time this clears. `aria-hidden`, because it is a curtain — the
            page behind it is the content, and a screen reader should be
            reading that rather than waiting for a photon.

            Always in the markup and inert unless `data-intro` is set, so
            there is nothing for React to mount and nothing to flash. */}
        <div className="intro" aria-hidden>
          <div className="intro-photon" />
          <p className="intro-words">
            <span className="cjk intro-cjk">智子</span>
            <span className="intro-say">You see what we want you to see.</span>
          </p>
        </div>
      </body>
    </html>
  );
}
