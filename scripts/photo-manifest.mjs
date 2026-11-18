/**
 * public/product/** → src/lib/commerce/photo-manifest.json
 *
 *   node scripts/photo-manifest.mjs     (runs before every `npm run build`)
 *
 * In dev the shop reads the photo folders live. A hosted build can't: on
 * Netlify the server code runs where public/ isn't (the files sit on the
 * CDN), so a page re-rendered after an edit in the shop editor would find no
 * photos and fall back to stand-ins. The manifest carries what the server
 * needs — file names, phone-size copies, the blur — inside the build.
 *
 * `v` is a hash of the file's bytes, so a reshoot gets a new address while
 * an unchanged photo keeps its address (and its year-long cache) across
 * deploys. A modified time would change on every fresh checkout.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "product");
const OUT = path.join(process.cwd(), "src", "lib", "commerce", "photo-manifest.json");
const PHOTO = /\.(jpe?g|png|webp|avif)$/i;

const hash = (file) =>
  createHash("sha1").update(readFileSync(file)).digest("base64url").slice(0, 8);

const manifest = {};
for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dir = path.join(ROOT, d.name);
  const names = readdirSync(dir)
    .filter((f) => PHOTO.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!names.length) continue;
  const blurFile = path.join(dir, "blur.json");
  const blur = existsSync(blurFile) ? JSON.parse(readFileSync(blurFile, "utf8")) : {};
  manifest[d.name] = names.map((file) => {
    const base = file.replace(/\.webp$/, "");
    const small = [432, 648]
      .filter((w) => existsSync(path.join(dir, "s", `${base}-${w}.webp`)))
      .map((w) => ({ w, v: hash(path.join(dir, "s", `${base}-${w}.webp`)) }));
    return {
      file,
      v: hash(path.join(dir, file)),
      ...(small.length ? { small } : {}),
      ...(blur[file] ? { blur: blur[file] } : {}),
    };
  });
}

writeFileSync(OUT, JSON.stringify(manifest) + "\n");
console.log(`photo manifest: ${Object.keys(manifest).length} products → ${path.relative(process.cwd(), OUT)}`);
