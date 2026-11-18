/**
 * 93+ · Best sellers
 *
 * Ranked by what people actually order. The order sheet's Apps Script
 * answers `GET ?action=counts` with units sold per product title, cancelled
 * orders left out (scripts/orders-sheet.gs). The shirts with orders lead,
 * most sold first.
 *
 * Until there are orders — or until the script is redeployed with that
 * endpoint — the row is the newest shirt from every team instead. It's never
 * empty, and it never claims a sales record that doesn't exist.
 */

import type { Collection, Product } from "./types";

const ROW = 8;

/** Units sold per product title, from the order sheet. Empty when unknown. */
async function orderCounts(): Promise<Map<string, number>> {
  const url = process.env.ORDERS_WEBHOOK_URL;
  if (!url) return new Map();
  try {
    const u = new URL(url);
    u.searchParams.set("action", "counts");
    u.searchParams.set("secret", process.env.ORDERS_WEBHOOK_SECRET ?? "");
    // Apps Script answers with a redirect to the result — follow it.
    const res = await fetch(u, { redirect: "follow", next: { revalidate: 900 } });
    const body = (await res.json()) as {
      ok?: boolean;
      counts?: Record<string, number>;
    };
    return body.ok && body.counts ? new Map(Object.entries(body.counts)) : new Map();
  } catch {
    // An old deployment without the endpoint answers with HTML. Fall back.
    return new Map();
  }
}

/** "Real Madrid Home 26/27" → 2026. No season in the title → 0. */
function season(title: string) {
  const m = title.match(/(\d{2,4})\/(\d{2})\b/);
  if (!m) return 0;
  const year = Number(m[1]);
  return year < 100 ? 2000 + year : year;
}

/** The newest current shirt in a team — home kit first, then catalogue order. */
function newest(shirts: Product[]) {
  const current = shirts.filter((p) => !p.collections?.includes("retro"));
  const pool = current.length ? current : shirts;
  const score = (p: Product) =>
    season(p.title) * 10 + (p.collections?.includes("home-kits") ? 1 : 0);
  // Strict > keeps the earlier product on a tie.
  return pool.reduce<Product | undefined>(
    (best, p) => (!best || score(p) > score(best) ? p : best),
    undefined,
  );
}

export async function rankBestSellers(products: Product[], teams: Collection[]) {
  const shirts = products.filter((p) => p.customisable && p.available);
  const counts = await orderCounts();

  const ordered = shirts
    .map((p) => ({ p, sold: counts.get(p.title) ?? 0 }))
    .filter((x) => x.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .map((x) => x.p);

  const latest = teams
    .map((team) => newest(shirts.filter((p) => p.collections?.includes(team.handle))))
    .filter((p): p is Product => Boolean(p));

  return [...new Set([...ordered, ...latest])].slice(0, ROW);
}
