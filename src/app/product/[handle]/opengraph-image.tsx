import { ImageResponse } from "next/og";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { PATH_SPARKLE, SPARKLE_VIEWBOX } from "@/components/ui/Logo";
import { getProduct, getProducts } from "@/lib/commerce";
import { formatPrice } from "@/lib/utils";
import { readBytes } from "@/lib/store";

/**
 * The link preview for one product — what a WhatsApp or Instagram share
 * shows. The shirt itself on the left, the name and price on the shop's
 * off-white on the right, so a shared link already sells the shirt.
 *
 * Built once per product at build time, like the page. Satori reads JPEG,
 * not WebP, so the front photo is converted on the way in.
 */

export const alt = "93+ football shirts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ handle: p.handle }));
}

const GROUND = "#f0eae0";
const INK = "#9c1305";
const DIM = "#7a5148";
const GRADIENT =
  "linear-gradient(90deg, #9c1305 0%, #b31909 24%, #c64616 48%, #d76821 72%, #e28b42 100%)";
const PHOTO_W = 473; // 3:4 at 630 high

/**
 * The front photo as bytes: an editor upload from the store, our own shoot
 * from disk — or, on a host where the server can't see public/ (Netlify),
 * from the site itself.
 */
async function photoBytes(url: string): Promise<Buffer | null> {
  const path = url.split("?")[0];
  const media = path.match(/^\/media\/([a-z0-9-]+\.webp)$/);
  if (media) return (await readBytes(`media/${media[1]}`))?.data ?? null;
  const file = join(process.cwd(), "public", path);
  if (existsSync(file)) return readFile(file);
  const origin = process.env.URL ?? process.env.SITE_URL;
  if (!origin) return null;
  try {
    const res = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(5000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function photoSrc(url: string) {
  if (!url.startsWith("/")) return url; // Shopify's CDN — Satori fetches it
  const bytes = await photoBytes(url);
  if (!bytes) return null;
  const jpeg = await sharp(bytes).resize({ height: size.height }).jpeg({ quality: 86 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [product, medium] = await Promise.all([
    getProduct(handle),
    readFile(join(process.cwd(), "src/assets/NeueHaasDisplay-Medium.ttf")),
  ]);
  const front = product?.images[0];
  const photo = front && !front.placeholder ? await photoSrc(front.url) : null;
  const min = product?.priceRange.min;
  const price = min ? formatPrice(min.cents, min.currency) : "";
  const ranged = product ? product.priceRange.min.cents !== product.priceRange.max.cents : false;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: GROUND,
          color: INK,
          fontFamily: "Neue Haas",
        }}
      >
        {photo ? (
          <img src={photo} width={PHOTO_W} height={size.height} style={{ objectFit: "cover" }} alt="" />
        ) : (
          <div style={{ width: PHOTO_W, height: size.height, backgroundImage: GRADIENT }} />
        )}

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px 64px 56px",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, width: size.width - PHOTO_W, height: 6, backgroundImage: GRADIENT }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM }}>
            <span>93+ · Football shirts</span>
            <span>{product?.category ?? ""}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 62, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
              {product?.title ?? "93+"}
            </div>
            {/* One string: Satori wants a single child unless the box is flex. */}
            <div style={{ marginTop: 22, fontSize: 30, letterSpacing: "-0.01em" }}>
              {`${ranged ? "From " : ""}${price}${product?.set ? ` · ${product.set}` : ""}`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM }}>
            <span>Delivery across Lebanon · 4–5 days</span>
            <svg width="30" height="30" viewBox={SPARKLE_VIEWBOX} fill={INK}>
              <path d={PATH_SPARKLE} />
            </svg>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Neue Haas", data: medium, style: "normal", weight: 500 }],
    },
  );
}
