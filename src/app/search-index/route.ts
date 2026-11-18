import { getSearchIndex } from "@/lib/commerce";

/**
 * The search index as one small JSON file, built with the site and
 * refreshed every 15 minutes. It used to ride inside every page's HTML
 * (~60 KB of every visit, parsed before anything could paint); now the
 * search panel fetches it once, in idle time, and keeps it.
 */
export const dynamic = "force-static";
export const revalidate = 900;

export async function GET() {
  return Response.json(await getSearchIndex(), {
    headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=86400" },
  });
}
