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
 * Decides the dimensional unfold, before anything is painted.
 *
 * This runs as a blocking script in `<head>`, which is the whole point of it.
 * The page is statically prerendered and arrives fully formed, so any decision
 * taken after hydration shows the finished page first and then collapses it —
 * the visitor sees a glitch, not an unfolding. Running here means the flat
 * state is in the style system before `<body>` is parsed.
 *
 * `?unfold=1` replays it regardless of whether this browser has seen it. That
 * exists because the alternative is clearing site storage by hand every time,
 * and a once-per-lifetime effect that cannot be replayed is one nobody can
 * judge — including whoever has to decide `--unfold-ms`. It overrides the
 * seen-already check and nothing else: a hidden tab still gets no animation
 * frames, and reduced motion is a preference rather than an obstacle.
 *
 * It refuses in four cases, and each is a case where the effect would be spent
 * on someone who cannot see it:
 *
 *  - not on `/`, because that is the only route with a hero to unfold into
 *  - in a hidden tab, because a middle-clicked link gets no paint and no
 *    animation, and would burn the one-shot in the background
 *  - under `prefers-reduced-motion`, where the key is deliberately *not*
 *    claimed: the setting asks not to be shown an animation, not to be struck
 *    off the list of people who have never seen one
 *  - if this browser has already seen it
 *
 * Written as a string rather than a function so it can be inlined verbatim. It
 * touches nothing React owns — one data attribute on the document element —
 * so there is no hydration mismatch to worry about, and it has nothing to tear
 * down: the CSS is written so that the finished animation leaves no transform
 * behind, rather than leaving one for a listener to come and clear.
 */
const unfoldScript = `(function(){try{
var d=document.documentElement;
if(location.pathname!=="/")return;
if(document.hidden)return;
if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
if(location.search.indexOf("unfold=1")<0&&localStorage.getItem("trisolaris.risen")==="1")return;
localStorage.setItem("trisolaris.risen","1");
d.dataset.unfold="flat";
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
        <script dangerouslySetInnerHTML={{ __html: unfoldScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-void text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-void"
        >
          Skip to content
        </a>

        <EraProvider>
          {/* The ground stays. It is what the page is pressed onto, and a
              horizon that collapses with the thing resting on it is not a
              horizon. */}
          <div className="era-wash" aria-hidden />
          <div className="unfold-line" aria-hidden />

          {/* Everything that is *document* — and nothing that is chrome over
              it. The notice and the departure panel are fixed-position and
              have to stay legible while the page behind them is still a
              line; they are also the only things that would be reading out
              an explanation from inside the effect they explain. */}
          <div className="unfold-root flex min-h-full flex-1 flex-col">
            <Nav />
            <main id="main" className="relative z-10 flex-1">
              {children}
            </main>
            <Footer />
          </div>

          <EraNotice />
          <Departure />
        </EraProvider>
      </body>
    </html>
  );
}
