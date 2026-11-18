import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PATH_3, PATH_9, PATH_SPARKLE } from "@/components/ui/Logo";

/**
 * The link preview — what WhatsApp and Instagram show when the shop is
 * shared. It's the preloader lockup frozen: black wordmark on the season
 * gradient, so the first thing anyone sees of 93+ is the same thing the
 * site opens on.
 *
 * Satori can't read woff2, so the tagline face is a TTF copy of Neue Haas
 * Medium in src/assets. The wordmark is paths and needs no font.
 */

export const alt = "93+ — Ninety minutes is a suggestion.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Summer Window ramp — the season the site is pinned to.
const GRADIENT =
  "linear-gradient(90deg, #9c1305 0%, #b31909 24%, #c64616 48%, #d76821 72%, #e28b42 100%)";
const INK = "#0a0a0a";

export default async function Image() {
  const medium = await readFile(
    join(process.cwd(), "src/assets/NeueHaasDisplay-Medium.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundImage: GRADIENT,
          color: INK,
          fontFamily: "Neue Haas",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
          <span>FOOTBALL SHIRTS</span>
          <span>93:24</span>
        </div>

        <svg width="760" height="389" viewBox="0 0 3000 1535.76" fill={INK}>
          <path d={PATH_9} />
          <path d={PATH_3} />
          <path d={PATH_SPARKLE} />
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 34,
            letterSpacing: "-0.01em",
          }}
        >
          <span>Ninety minutes is a suggestion.</span>
          <span style={{ fontSize: 26 }}>DELIVERY ACROSS LEBANON</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Neue Haas", data: medium, style: "normal", weight: 500 }],
    },
  );
}
