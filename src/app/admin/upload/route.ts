import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { isAdmin } from "@/lib/admin/session";
import { writeBytes, writeJSON } from "@/lib/store";

/**
 * A photo from the shop editor → the shop's photo sizes.
 *
 * Cropped to the shop's 3:4 frame (centred, like our own shoots), turned the
 * right way up, and saved three times: 864 px wide for the product page,
 * 432 and 648 for phones, plus a 12×16 blur the page paints while it loads.
 * The browser already shrank it before sending (ProductEditor), so this is
 * quick and never near a host's upload limit.
 */

const MAX_BYTES = 12 * 1024 * 1024;

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!(await isAdmin())) return fail(401, "You're signed out. Reload the page and sign in.");
  // The editor's own page only.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return fail(403, "Not allowed.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail(400, "No photo came through. Try again.");
  if (file.size > MAX_BYTES) return fail(413, "That photo is too big. Try a smaller one.");

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const main = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(864, 1152, { fit: "cover", position: "centre" })
      .webp({ quality: 90, effort: 5 })
      .toBuffer();
    const [s432, s648, tiny] = await Promise.all([
      sharp(main).resize({ width: 432 }).webp({ quality: 88, effort: 5 }).toBuffer(),
      sharp(main).resize({ width: 648 }).webp({ quality: 88, effort: 5 }).toBuffer(),
      sharp(main).resize(12, 16).webp({ quality: 50 }).toBuffer(),
    ]);
    const id = Date.now().toString(36) + randomBytes(6).toString("hex");
    await Promise.all([
      writeBytes(`media/${id}.webp`, main, "image/webp"),
      writeBytes(`media/${id}-432.webp`, s432, "image/webp"),
      writeBytes(`media/${id}-648.webp`, s648, "image/webp"),
    ]);
    const photo = {
      url: `/media/${id}.webp`,
      srcSet: `/media/${id}-432.webp 432w, /media/${id}-648.webp 648w, /media/${id}.webp 864w`,
      blur: `data:image/webp;base64,${tiny.toString("base64")}`,
    };
    await writeJSON(`media/${id}.json`, photo);
    return Response.json({
      ok: true,
      photo: { url: photo.url, preview: `/media/${id}-648.webp`, blur: photo.blur },
    });
  } catch (err) {
    console.error("[upload]", err);
    return fail(415, "That file isn't a photo we can read. Try a JPG or PNG.");
  }
}
