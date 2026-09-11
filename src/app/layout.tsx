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
 *
 * `display=block`, not `swap`. `.cjk` falls back to `var(--font-display)`,
 * which is Latin-only, so every CJK glyph on the site lands in a system
 * Song/Ming face and then restyles when the subset arrives. Usually that is a
 * minor flicker; on the arrival screen it is two large glyphs visibly changing
 * shape several hundred milliseconds into a motionless black hold, which is a
 * far bigger artefact than the halo banding this page already went to three
 * attempts to remove.
 *
 * The cost lands where it is cheapest. This is requested once per document
 * load and cached after, so the blocking period only bites on the first load
 * of a session — which is the load with the curtain over it. The block period
 * is capped at 3s and `--intro-hold` is 3s, so a subset that never arrives
 * swaps in at the moment the tear starts, masked by it.
 */
const notoSerifSc = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&text=${encodeURIComponent(
  CJK_GLYPHS,
)}&display=block`;

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
 * Decides the arrival sequence, before anything is painted — and ends it.
 *
 * This runs as a blocking script in `<head>`. The page is statically
 * prerendered and arrives fully formed, so a decision taken after hydration
 * shows the finished page first and *then* drops a black screen over it. It
 * sits after the stylesheet links deliberately: a classic non-async script is
 * blocked until pending stylesheets load, which is exactly what is wanted
 * here — those stylesheets also block the first paint, so this has always run
 * by the time anything is on screen, and it can read `--intro-hold` straight
 * out of the cascade rather than keeping a second copy of it.
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
 * Scrolling is pinned rather than locked with `overflow: hidden`. The lock is
 * the obvious fix and it is wrong here: hiding the root's overflow takes the
 * scrollbar's width back, `scrollbar-gutter: stable` does not reserve a gutter
 * for `hidden` (measured — the page came out 15px wider while locked), and the
 * page would therefore reflow its text sideways at the exact instant the tear
 * reveals it. Pinning the scroll position changes no layout at all and catches
 * every input, including a scrollbar drag, which `preventDefault` on wheel and
 * touch alone would miss. Without it a visitor who reads three motionless
 * seconds as a stuck page and flicks the wheel gets no feedback, and the tear
 * then reveals them halfway down the projects list — with the simulation, the
 * entire reason this is an overlay, off screen.
 *
 * **The attribute is removed at the end, and that is load-bearing.** An
 * attribute with no end state is one nothing can be hung off, because any
 * guard attached to it outlives the thing it was guarding. With an end, the
 * scroll lock in `globals.css` becomes possible, the infinite photon
 * animation stops because `.intro` goes back to `display: none`, and — the
 * reason it is belt *and* braces — a curtain that fails to animate is still
 * taken down. One CSS animation completing used to be the only thing between
 * a visitor and a permanently black page, and `animation: none !important`
 * from an extension or a user stylesheet is both common and *not* the same
 * setting as `prefers-reduced-motion`.
 *
 * The key is claimed at the end rather than at parse time, for the same reason
 * the four guards exist. Somebody who reloads at 400ms because a black page
 * reads as a broken one had not seen it, and should not have spent it. There
 * is no re-entrancy to protect against: this runs once per document load.
 *
 * `?intro=1` replays it regardless. A once-per-lifetime sequence that cannot
 * be replayed is one nobody can judge, and the alternative is clearing site
 * storage by hand.
 */
const introScript = `(function(){try{
var d=document.documentElement;
if(location.pathname!=="/")return;
if(document.hidden)return;
if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var replay=false;
try{replay=new URLSearchParams(location.search).get("intro")==="1";}catch(e){}
if(!replay&&localStorage.getItem("trisolaris.intro")==="1")return;
d.setAttribute("data-intro","on");
var stop=function(e){e.preventDefault();},pin=function(){window.scrollTo(0,0);};
window.addEventListener("wheel",stop,{passive:false});
window.addEventListener("touchmove",stop,{passive:false});
window.addEventListener("scroll",pin);
var cs=getComputedStyle(d),done=false;
var ms=function(n){var v=cs.getPropertyValue(n).trim();
return v.slice(-2)==="ms"?parseFloat(v):v.slice(-1)==="s"?parseFloat(v)*1000:0;};
var end=function(){if(done)return;done=true;
document.removeEventListener("animationend",onEnd,true);
window.removeEventListener("wheel",stop);
window.removeEventListener("touchmove",stop);
window.removeEventListener("scroll",pin);
d.removeAttribute("data-intro");
try{localStorage.setItem("trisolaris.intro","1");}catch(e){}};
var onEnd=function(e){if(e.animationName==="intro-tear")end();};
document.addEventListener("animationend",onEnd,true);
var total=ms("--intro-hold")+ms("--intro-glitch");
setTimeout(end,(total||5000)+1500);
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
          className="skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-void"
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
