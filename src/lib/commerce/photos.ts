import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import manifest from "./photo-manifest.json";
import type { Entry, StoredPhoto } from "./inventory";
import { placeholderImages, roleFromUrl, type ProductImage } from "./types";

/**
 * Where a product's photos come from.
 *
 *   - the shop editor placed them → `entry.photos`, in its order
 *   - otherwise the shoot in `public/product/<handle>/`, in filename order:
 *     `01-front · 02-hover · 03-back · 04-detail`, the first being the grid
 *     image. In dev the folder is read live, so a new shoot shows up at once;
 *     a production build reads `photo-manifest.json`, written from the same
 *     folders when the build starts (scripts/photo-manifest.mjs), because a
 *     hosted server can't see public/.
 *   - neither → typeset stand-ins.
 *
 * Every URL carries `?v=` — photos are cached for a year, so a reshoot under
 * the same filename needs a new address.
 */

const PHOTO = /\.(jpe?g|png|webp|avif)$/i;
const DEV = process.env.NODE_ENV !== "production";

type Shot = { file: string; v: string; small?: { w: number; v: string }[]; blur?: string };
const MANIFEST = manifest as Record<string, Shot[]>;

/** The live folder, shaped like the manifest. Modified time stands in for the hash. */
function readShoot(handle: string): Shot[] {
  const dir = path.join(process.cwd(), "public", "product", handle);
  if (!existsSync(dir)) return [];
  const blurFile = path.join(dir, "blur.json");
  const blur: Record<string, string> = existsSync(blurFile)
    ? JSON.parse(readFileSync(blurFile, "utf8"))
    : {};
  const v = (file: string) => Math.round(statSync(path.join(dir, file)).mtimeMs).toString(36);
  return readdirSync(dir)
    .filter((f) => PHOTO.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => {
      const base = file.replace(/\.webp$/, "");
      const small = [432, 648]
        .filter((w) => existsSync(path.join(dir, "s", `${base}-${w}.webp`)))
        .map((w) => ({ w, v: v(`s/${base}-${w}.webp`) }));
      return { file, v: v(file), ...(small.length ? { small } : {}), blur: blur[file] };
    });
}

const shootOf = (handle: string) => (DEV ? readShoot(handle) : (MANIFEST[handle] ?? []));

function shotImage(handle: string, shot: Shot): ProductImage {
  const url = `/product/${handle}/${shot.file}?v=${shot.v}`;
  const base = shot.file.replace(/\.webp$/, "");
  const srcSet = shot.small?.length
    ? [
        ...shot.small.map(({ w, v }) => `/product/${handle}/s/${base}-${w}.webp?v=${v} ${w}w`),
        `${url} 864w`,
      ].join(", ")
    : undefined;
  return { url, width: 864, height: 1152, alt: "", role: roleFromUrl(url), blur: shot.blur, srcSet };
}

/** The shoot frames as the editor sees them: plain paths, no versions. */
export function shootPhotos(handle: string): StoredPhoto[] {
  return shootOf(handle).map((s) => ({ url: `/product/${handle}/${s.file}`, role: roleFromUrl(s.file) }));
}

const SHOOT_URL = /^\/product\/([a-z0-9-]+)\/([\w.-]+)$/;

/** One placed photo → what the page draws. */
function storedImage(p: StoredPhoto): ProductImage | null {
  const shoot = p.url.match(SHOOT_URL);
  if (shoot) {
    const shot = shootOf(shoot[1]).find((s) => s.file === shoot[2]);
    return shot ? { ...shotImage(shoot[1], shot), role: p.role ?? roleFromUrl(p.url) } : null;
  }
  return { url: p.url, width: 864, height: 1152, alt: "", role: p.role, blur: p.blur, srcSet: p.srcSet };
}

export function imagesFor(entry: Pick<Entry, "handle" | "title" | "photos">): ProductImage[] {
  if (entry.photos) {
    const images = entry.photos.flatMap((p) => storedImage(p) ?? []);
    if (!images.length) return placeholderImages(entry.title);
    // Two-photo products let the second frame do the hover and the back.
    return images.length === 1 ? [images[0], { ...images[0], role: undefined }] : images;
  }
  const shots = shootOf(entry.handle);
  if (!shots.length) return placeholderImages(entry.title);
  const images = shots.map((s) => shotImage(entry.handle, s));
  return images.length === 1 ? [images[0], images[0]] : images;
}

/** A photo as the shop editor handles it: the stored path plus something to show. */
export type EditorPhoto = StoredPhoto & { preview: string };

/** The photos the editor starts from — what the shop shows, minus the stand-in duplicates. */
export function editorPhotos(entry: Pick<Entry, "handle" | "title" | "photos">): EditorPhoto[] {
  const placed = entry.photos ?? shootPhotos(entry.handle);
  return placed.flatMap((p) => {
    const image = storedImage(p);
    return image
      ? [{ ...p, preview: image.srcSet?.split(", ")[1]?.split(" ")[0] ?? image.url, blur: image.blur }]
      : [];
  });
}

/** True when this path is a frame of one of our own shoots. */
export function isShootPhoto(url: string) {
  const m = url.match(SHOOT_URL);
  return Boolean(m && shootOf(m[1]).some((s) => s.file === m[2]));
}
