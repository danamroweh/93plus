import { readBytes } from "@/lib/store";

/**
 * Photos uploaded in the shop editor, served from the store. Every upload
 * gets a new name, so each file can be cached for a year — by the browser
 * and by the CDN in front of the site.
 */
const NAME = /^[a-z0-9]{10,40}(-432|-648)?\.webp$/;
const YEAR = "public, max-age=31536000, immutable";

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!NAME.test(file)) return new Response("Not found", { status: 404 });
  const hit = await readBytes(`media/${file}`);
  if (!hit) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(hit.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": YEAR,
      "CDN-Cache-Control": YEAR,
    },
  });
}
