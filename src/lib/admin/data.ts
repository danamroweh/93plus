import { CATEGORIES, KIT_COLLECTION, PRICES, TEAM_ALIASES, UCL, UCL_TEAMS, type Item, type Kit } from "@/lib/commerce/catalogue";
import {
  CODE_HANDLES,
  categoriesOf,
  entriesOf,
  hasVersions,
  leaguesOf,
  loadDoc,
  printingOf,
  teamsOf,
  type Doc,
  type Entry,
} from "@/lib/commerce/inventory";
import { editorPhotos } from "@/lib/commerce/photos";
import { listOrders } from "@/lib/commerce/orders";
import { storeKind } from "@/lib/store";
import type { AdminProduct, AdminSnapshot } from "./types";

/** What a new product starts at, and what a code product costs when it never set its own. */
export const DEFAULT_PRICES: AdminSnapshot["defaults"] = {
  Home: { fan: PRICES.fan, player: PRICES.player },
  Away: { fan: PRICES.fan, player: PRICES.player },
  Third: { fan: PRICES.fan, player: PRICES.player },
  Retro: { fan: PRICES.retro },
  "Long sleeve": { fan: PRICES.longSleeve },
  Tracksuit: { fan: PRICES.tracksuit },
  Keychain: { fan: PRICES.Keychain },
  Mug: { fan: PRICES.Mug },
  Pillow: { fan: PRICES.Pillow },
};

/** The prices a product actually sells at, defaults filled in. */
export function effectivePrices(e: Pick<Entry, "kind" | "kit" | "item" | "fan" | "player" | "cents">) {
  if (e.kind === "printable") {
    const item: Item = e.item ?? "Keychain";
    return { fan: null, player: null, cents: e.cents ?? DEFAULT_PRICES[item].fan };
  }
  const kit: Kit = e.kit ?? "Home";
  return {
    fan: e.fan ?? DEFAULT_PRICES[kit].fan,
    player: hasVersions(kit) ? (e.player ?? DEFAULT_PRICES[kit].player ?? PRICES.player) : null,
    cents: null,
  };
}

export function toAdmin(e: Entry): AdminProduct {
  return {
    handle: e.handle,
    kind: e.kind,
    title: e.title,
    description: e.description,
    team: e.team ?? null,
    kit: e.kind === "shirt" ? (e.kit ?? "Home") : null,
    item: e.kind === "printable" ? (e.item ?? "Keychain") : null,
    ...effectivePrices(e),
    stock: e.stock ?? { track: false },
    hidden: Boolean(e.hidden),
    deleted: e.deleted ?? null,
    photos: editorPhotos(e).map(({ url, role, preview, blur }) => ({
      url,
      ...(role && { role }),
      preview,
      ...(blur && { blur }),
    })),
    categories: e.categories ?? null,
    ucl: Boolean(e.ucl),
    createdAt: e.createdAt ?? null,
    fromCode: CODE_HANDLES.has(e.handle),
  };
}

/** "26/27" from August, "25/26" before it. */
export function currentSeason(now = new Date()) {
  const y = now.getFullYear() % 100;
  const start = now.getMonth() >= 6 ? y : y - 1;
  return `${String(start).padStart(2, "0")}/${String((start + 1) % 100).padStart(2, "0")}`;
}

const CODE_CATEGORIES = new Set(CATEGORIES.map(([h]) => h));

export function snapshotOf(doc: Doc, orders: AdminSnapshot["orders"]): AdminSnapshot {
  const names = teamsOf(doc);
  const leagues = leaguesOf(doc);
  return {
    products: entriesOf(doc).map(toAdmin),
    teams: Object.entries(names).map(([handle, title]) => ({
      handle,
      title,
      league: leagues.find((l) => l.teams.includes(handle))?.handle ?? null,
      aliases: (TEAM_ALIASES as Record<string, string[]>)[handle] ?? [],
    })),
    leagues: leagues.map(({ handle, title }) => ({ handle, title, custom: handle in doc.leagues })),
    categories: categoriesOf(doc).map(([handle, title]) => ({ handle, title, custom: !CODE_CATEGORIES.has(handle) })),
    rules: { kitCategory: KIT_COLLECTION, uclTeams: [...UCL_TEAMS], ucl: UCL.handle },
    orders,
    printing: printingOf(doc),
    season: currentSeason(),
    defaults: DEFAULT_PRICES,
    storage: storeKind,
  };
}

export async function snapshot() {
  const [doc, orders] = await Promise.all([loadDoc(), listOrders().catch(() => [])]);
  return snapshotOf(doc, orders);
}
