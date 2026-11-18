import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SiteProvider } from "@/components/providers/SiteProvider";
import { Preloader } from "@/components/layout/Preloader";
import { HOME_PATH, SEEN_FOR_MS, SEEN_KEY } from "@/lib/preloader";
import { Cursor } from "@/components/ui/Cursor";
import { BackToTop } from "@/components/ui/BackToTop";
import { getSeason } from "@/lib/seasons";
import { SearchProvider } from "@/components/search/Search";
import { LEAGUES, TEAMS } from "@/lib/commerce/catalogue";
import "./globals.css";

/**
 * Neue Haas *Display* — drawn for large sizes, which suits a display-led
 * brand. Three weights only; Bold sits between Medium and Black and just
 * muddies the hierarchy.
 */
const neueHaas = localFont({
  src: [
    { path: "../fonts/NeueHaasDisplay-Roman.woff2", weight: "400", style: "normal" },
    { path: "../fonts/NeueHaasDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/NeueHaasDisplay-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-neue-haas",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

/**
 * Shirt numerals only. Real kits never use the brand typeface — every club
 * has a bespoke squared numeral set — so a separate condensed display face
 * reads as correct here rather than lazy.
 */
const jersey = localFont({
  // Anton (OFL), latin subset, self-hosted: next/font/google fetched it from
  // Google at build time, so a build with no route to fonts.googleapis.com
  // failed outright. The file is 12 KB and never changes.
  src: "../fonts/Anton-Regular-latin.woff2",
  weight: "400",
  variable: "--font-jersey",
  display: "swap",
  fallback: ["Impact", "Arial Narrow", "sans-serif"],
});

export const metadata: Metadata = {
  // Absolute base for the share image: SITE_URL (the real domain, once it's
  // set), else the address Netlify gives the site (URL), else a placeholder.
  metadataBase: new URL(process.env.SITE_URL || process.env.URL || "https://93plus.shop"),
  title: {
    default: "93+ — Ninety minutes is a suggestion.",
    template: "%s | 93+",
  },
  description:
    "Football shirts and accessories. Built for the minute everything changes.",
  openGraph: {
    title: "93+",
    description: "Ninety minutes is a suggestion.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f0eae0",
  colorScheme: "light",
};

/**
 * Runs during HTML parsing, before first paint. A returning visitor — or
 * anyone landing on a page other than home, like a shirt link shared on
 * WhatsApp — gets `data-preloaded`, which CSS reads to hide the preloader
 * and drop the header in without waiting for the JS bundle. A data attribute rather
 * than a class, because React owns `className` and resets it on hydration. The server/client `type` swap is the
 * Next-recommended way to keep React from re-running or warning about it.
 */
const SKIP_PRELOADER = `var d=document.documentElement;if(!${HOME_PATH}.test(location.pathname))d.dataset.preloaded="";else try{if(Date.now()-Number(localStorage.getItem(${JSON.stringify(SEEN_KEY)}))<${SEEN_FOR_MS})d.dataset.preloaded=""}catch(e){}`;

/** Tapped-in searches before anything is typed. */
const SUGGESTIONS = [
  "Ronaldo",
  "Messi",
  ...Object.values(TEAMS).slice(0, 8),
  "Argentina",
  "Portugal",
  "Brazil",
  ...LEAGUES.filter((l) => !l.nations).slice(0, 4).map((l) => l.title),
  "Retro",
  "Accessories",
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const season = getSeason();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-season={season.id}
      className={`${neueHaas.variable} ${jersey.variable}`}
    >
      <head>
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: SKIP_PRELOADER }}
        />
        {/* `loaded` is added by the Preloader at handover, which is what
            reveals the header and season mark. Without JS that never fires,
            so reveal them unconditionally instead of shipping a blank page. */}
        <noscript>
          <style>{`#header,#season-mark{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="bg-ground text-ink antialiased">
        <SiteProvider>
          <CartProvider>
            <SearchProvider suggestions={SUGGESTIONS}>
              <Preloader season={season} />
              <Cursor />
              {children}
              <BackToTop />
              <CartDrawer />
            </SearchProvider>
          </CartProvider>
        </SiteProvider>
      </body>
    </html>
  );
}
