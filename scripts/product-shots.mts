/**
 * Picked takes → the four product frames.
 *
 *   npm run shots shoots/<handle>
 *     → public/product/<handle>/01-front · 02-hover · 03-back · 04-detail
 *
 * The shoot folder holds the picked takes and their masks (BiRefNet,
 * "General Use (Dynamic)" — the others clip the C-stand arm):
 *
 *   front.png   front-mask*.png   several masks are unioned
 *   back.png    back-mask*.png
 *   detail.png
 *
 * The hover is never generated. Image models re-render the shirt — tint it
 * pink, nudge it a few pixels — and the card's wipe then shows a seam.
 * Here every subject pixel is the front's own; only the backdrop changes
 * temperature:
 *
 *   cold = I + (1-a)(B_soft       - B_old)
 *   hot  = I + (1-a)(ramp(B_soft) - B_old) + edge wrap
 *
 * B_old is the backdrop under each pixel (masked normalised convolution,
 * holes filled coarse-to-fine), B_soft the same light feathered so a hard
 * spotlight edge doesn't survive. Since an edge pixel is a·F + (1-a)·B_old,
 * adding (1-a)(B_new - B_old) also decontaminates the anti-aliased edge,
 * and I - B_old carries the paper's own grain across. The back is laid on
 * the front's B_soft so both frames share one backdrop light.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

type Img = { d: Float32Array; W: number; H: number };

/** q94 is ~17× smaller than PNG and clean even on the backdrop gradients with the levels pushed. */
const WEBP = { quality: 94, effort: 6 } as const;

async function load(file: string, grey = false): Promise<Img> {
  let img = sharp(file).removeAlpha();
  if (grey) img = img.greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const d = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) d[i] = data[i] / 255;
  return { d, W: info.width, H: info.height };
}

/** Centred 3:4 crop — the grid cell and the gallery are both 9:12. */
function shirtCrop(W: number, H: number) {
  const h = Math.min(H, Math.round((W * 4) / 3));
  const w = Math.min(W, Math.round((h * 3) / 4));
  return { left: Math.floor((W - w) / 2), top: Math.floor((H - h) / 2), width: w, height: h };
}

async function save(file: string, d: Float32Array, W: number, H: number) {
  const out = Buffer.alloc(d.length);
  for (let i = 0; i < d.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(d[i] * 255)));
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .extract(shirtCrop(W, H))
    .webp(WEBP)
    .toFile(file);
}

// ── gaussian as three box passes: O(n) at any sigma ─────────────────────
function boxRadii(sigma: number, n = 3) {
  let wl = Math.floor(Math.sqrt((12 * sigma * sigma) / n + 1));
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => ((i < m ? wl : wl + 2) - 1) / 2);
}
function boxH(src: Float32Array, dst: Float32Array, W: number, H: number, r: number) {
  const k = 1 / (r + r + 1);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let acc = 0;
    for (let x = -r - 1; x < r; x++) acc += src[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      acc += src[row + Math.min(W - 1, x + r)] - src[row + Math.max(0, x - r - 1)];
      dst[row + x] = acc * k;
    }
  }
}
function boxV(src: Float32Array, dst: Float32Array, W: number, H: number, r: number) {
  const k = 1 / (r + r + 1);
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r - 1; y < r; y++) acc += src[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      acc += src[Math.min(H - 1, y + r) * W + x] - src[Math.max(0, y - r - 1) * W + x];
      dst[y * W + x] = acc * k;
    }
  }
}
function blur(ch: Float32Array, W: number, H: number, sigma: number) {
  const a = Float32Array.from(ch);
  const b = new Float32Array(ch.length);
  for (const r of boxRadii(sigma)) {
    boxH(a, b, W, H, Math.round(r));
    boxV(b, a, W, H, Math.round(r));
  }
  return a;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The backdrop under every pixel, subject excluded, coarse levels filling holes. */
function plate(I: Img, w: Float32Array, sigmas: number[]) {
  const { W, H } = I;
  const N = W * H;
  const levels = sigmas.map((s) => ({
    den: blur(w, W, H, s),
    num: [0, 1, 2].map((c) => {
      const p = new Float32Array(N);
      for (let i = 0; i < N; i++) p[i] = I.d[i * 3 + c] * w[i];
      return blur(p, W, H, s);
    }),
  }));
  const out = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const last = levels[levels.length - 1];
  for (let i = 0; i < N; i++)
    for (let c = 0; c < 3; c++) {
      let v = last.num[c][i] / Math.max(1e-6, last.den[i]);
      for (let l = levels.length - 2; l >= 0; l--) {
        const k = smooth(0.05, 0.35, levels[l].den[i]);
        v = v * (1 - k) + (levels[l].num[c][i] / Math.max(1e-6, levels[l].den[i])) * k;
      }
      out[c][i] = v;
    }
  return out;
}

/**
 * Union of the masks, with the interior pushed solid. White fabric on a pale
 * backdrop leaves BiRefNet unsure, so a shirt's body can come back half
 * transparent; the eroded core of the confident region is forced to 1 and
 * only the outer few pixels keep the model's soft edge.
 */
async function alpha(files: string[], W: number, H: number) {
  const N = W * H;
  const a = new Float32Array(N);
  for (const f of files) {
    const m = await load(f, true);
    for (let i = 0; i < N; i++) a[i] = Math.max(a[i], m.d[i]);
  }
  for (let i = 0; i < N; i++) a[i] = Math.min(1, Math.max(0, (a[i] - 0.04) / 0.92));
  const core = blur(a.map((v) => (v > 0.35 ? 1 : 0)), W, H, 2.5);
  for (let i = 0; i < N; i++) if (core[i] > 0.99) a[i] = 1;
  return a;
}

/** Backdrop weights: subject out, plus a ~3px margin so edges never feed the plate. */
function backdropWeight(a: Float32Array, W: number, H: number) {
  const hard = a.map((v) => (v > 0.02 ? 1 : 0));
  const grown = blur(hard, W, H, 1.5);
  return grown.map((v) => (v > 0.01 ? 0 : 1));
}

/** Summer Window — globals.css --g-1 … --g-5. The hot frame is the site's own gradient. */
const RAMP = ["#9c1305", "#b31909", "#c64616", "#d76821", "#e28b42"].map((h) =>
  [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16) / 255),
);
function ramp(t: number) {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((c) => RAMP[i][c] * (1 - f) + RAMP[i + 1][c] * f);
}

async function main() {
  const shoot = process.argv[2];
  if (!shoot || !existsSync(shoot)) {
    console.error("usage: npm run shots shoots/<handle>");
    process.exit(1);
  }
  const handle = path.basename(path.resolve(shoot));
  const out = path.join("public", "product", handle);
  mkdirSync(out, { recursive: true });
  const masks = (prefix: string) =>
    readdirSync(shoot)
      .filter((f) => f.startsWith(`${prefix}-mask`) && f.endsWith(".png"))
      .map((f) => path.join(shoot, f));

  // ── front + hover ───────────────────────────────────────────────────
  const I = await load(path.join(shoot, "front.png"));
  const { W, H } = I;
  const N = W * H;
  const a = await alpha(masks("front"), W, H);
  const w = backdropWeight(a, W, H);
  const Bold = plate(I, w, [3, 20, 80]);
  const Bsoft = plate(I, w, [55, 200]);

  // tonal range of the backdrop light, mapped onto the ramp
  const Ls: number[] = [];
  for (let i = 0; i < N; i += 7) if (w[i] > 0) Ls.push(lum(Bsoft[0][i], Bsoft[1][i], Bsoft[2][i]));
  Ls.sort((x, y) => x - y);
  const lo = Ls[Math.floor(Ls.length * 0.01)];
  const hi = Ls[Math.floor(Ls.length * 0.995)];

  const aSoft = blur(a, W, H, 4);
  const cold = new Float32Array(N * 3);
  const hot = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = (lum(Bsoft[0][i], Bsoft[1][i], Bsoft[2][i]) - lo) / (hi - lo);
    const warm = ramp(Math.pow(Math.min(1, Math.max(0, t)), 1.05));
    // inner edge band — where a hot backdrop would wrap onto the subject
    const band = Math.min(1, Math.max(0, a[i] * (1 - aSoft[i]) * 2.5));
    for (let c = 0; c < 3; c++) {
      const x = I.d[i * 3 + c];
      cold[i * 3 + c] = x + (1 - a[i]) * (Bsoft[c][i] - Bold[c][i]);
      hot[i * 3 + c] = x + (1 - a[i]) * (warm[c] - Bold[c][i]) + band * 0.4 * (warm[c] - Bsoft[c][i]);
    }
  }
  await save(path.join(out, "01-front.webp"), cold, W, H);
  await save(path.join(out, "02-hover.webp"), hot, W, H);

  // ── back, on the front's backdrop light ─────────────────────────────
  const backFile = path.join(shoot, "back.png");
  if (existsSync(backFile)) {
    const Ib = await load(backFile);
    if (Ib.W !== W || Ib.H !== H) throw new Error("back.png must match front.png's size");
    const ab = await alpha(masks("back"), W, H);
    const BoldB = plate(Ib, backdropWeight(ab, W, H), [3, 20, 80]);
    const back = new Float32Array(N * 3);
    for (let i = 0; i < N; i++)
      for (let c = 0; c < 3; c++)
        back[i * 3 + c] = Ib.d[i * 3 + c] + (1 - ab[i]) * (Bsoft[c][i] - BoldB[c][i]);
    await save(path.join(out, "03-back.webp"), back, W, H);
  }

  // ── detail: crop only ───────────────────────────────────────────────
  const detailFile = path.join(shoot, "detail.png");
  if (existsSync(detailFile)) {
    const meta = await sharp(detailFile).metadata();
    await sharp(detailFile)
      .extract(shirtCrop(meta.width!, meta.height!))
      .webp(WEBP)
      .toFile(path.join(out, "04-detail.webp"));
  }

  await writeBlur(out);
  await writeSmall(out);
  console.log(`→ ${out}`);
}

/**
 * s/<frame>-432.webp and s/<frame>-648.webp — the widths a phone's grid
 * slot actually needs (a 2× and a 3× screen at half the viewport). The page
 * lists them in a srcset next to the 864 original, so a phone never
 * downloads more pixels than it can show.
 */
export async function writeSmall(dir: string) {
  mkdirSync(path.join(dir, "s"), { recursive: true });
  for (const f of readdirSync(dir).filter((f) => /^0[1-4]-[a-z]+\.webp$/.test(f)))
    for (const w of [432, 648])
      await sharp(path.join(dir, f))
        .resize({ width: w })
        .webp({ quality: 90, effort: 6 })
        .toFile(path.join(dir, "s", f.replace(/\.webp$/, `-${w}.webp`)));
}

/**
 * blur.json — a 12×16 copy of every frame as a data URL, inlined in the page
 * so a card shows its colours the instant it renders, before the photo
 * arrives. ~200 bytes each.
 */
export async function writeBlur(dir: string) {
  const blur: Record<string, string> = {};
  for (const f of readdirSync(dir).filter((f) => /^0[1-4]-[a-z]+\.webp$/.test(f)).sort()) {
    const buf = await sharp(path.join(dir, f)).resize(12, 16).webp({ quality: 50 }).toBuffer();
    blur[f] = `data:image/webp;base64,${buf.toString("base64")}`;
  }
  writeFileSync(path.join(dir, "blur.json"), JSON.stringify(blur, null, 1) + "\n");
}

// `npm run shots -- --blur-only` refreshes blur.json in every product folder;
// `--small-only` the phone-size copies.
if (process.argv[2] === "--blur-only") {
  for (const d of readdirSync(path.join("public", "product"), { withFileTypes: true }))
    if (d.isDirectory()) await writeBlur(path.join("public", "product", d.name));
  console.log("blur.json written");
} else if (process.argv[2] === "--small-only") {
  for (const d of readdirSync(path.join("public", "product"), { withFileTypes: true }))
    if (d.isDirectory()) await writeSmall(path.join("public", "product", d.name));
  console.log("small copies written");
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
