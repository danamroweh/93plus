/**
 * The seam between the site and whatever is selling the shirts.
 *
 * Every product, cart and checkout call in the UI goes through here.
 * Nothing above this file knows Shopify exists, so moving the backend
 * is a change to this module and nothing else.
 *
 * Plug and play: set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN
 * (see SHOPIFY.md) and the site runs on Shopify. Unset them and it falls
 * back to the demo catalogue in `./catalogue`.
 */

import { mockAdapter } from "./mock";
import { shopifyAdapter } from "./shopify";
import { leaguesOf, loadDoc, teamsOf } from "./inventory";
import { rankBestSellers } from "./bestsellers";
import { searchIndex } from "./search";
import type { CommerceAdapter, League } from "./types";

export const isShopify = Boolean(
  process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_TOKEN,
);

export const adapter: CommerceAdapter = isShopify ? shopifyAdapter : mockAdapter;

export const getProducts = () => adapter.getProducts();
export const getCollectionProducts = (handle: string) =>
  adapter.getCollectionProducts(handle);
export const getProduct = (handle: string) => adapter.getProduct(handle);
export const getCollections = (kind: "team" | "category") =>
  adapter.getCollections(kind);

/** Most ordered shirts first, topped up with each team's newest shirt. */
export async function getBestSellers() {
  const [products, teams] = await Promise.all([
    adapter.getProducts(),
    adapter.getCollections("team"),
  ]);
  return rankBestSellers(products, teams);
}

/**
 * Leagues from the catalogue, resolved to the team collections that exist,
 * most famous club first. A league with no stocked team doesn't show.
 */
export async function getLeagues(): Promise<League[]> {
  const [teams, doc] = await Promise.all([adapter.getCollections("team"), loadDoc()]);
  return leaguesOf(doc).map((league) => ({
    handle: league.handle,
    title: league.title,
    teams: league.teams.flatMap((h) => teams.find((t) => t.handle === h) ?? []),
  })).filter((league) => league.teams.length > 0);
}

export async function getSearchIndex() {
  const [products, doc] = await Promise.all([adapter.getProducts(), loadDoc()]);
  return searchIndex(products, teamsOf(doc), leaguesOf(doc));
}

export * from "./types";
