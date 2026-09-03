import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

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
      </head>
      <body className="flex min-h-full flex-col bg-void text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-void"
        >
          Skip to content
        </a>

        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
