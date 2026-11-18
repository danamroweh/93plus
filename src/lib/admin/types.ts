import type { Item, Kit } from "@/lib/commerce/catalogue";
import type { Stock } from "@/lib/commerce/inventory";
import type { ImageRole } from "@/lib/commerce/types";

/**
 * What the shop editor's screens work with. Plain data, safe to hand to the
 * browser; the server turns it back into catalogue entries (app/admin/actions.ts).
 */

export type { Stock };

export type AdminPhoto = {
  /** Stored path — `/product/<handle>/<file>` or `/media/<id>.webp`. */
  url: string;
  role?: ImageRole;
  /** What to show in the editor (versioned, phone-size where there is one). */
  preview: string;
  blur?: string;
};

export type AdminProduct = {
  handle: string;
  kind: "shirt" | "printable";
  title: string;
  description: string;
  team: string | null;
  kit: Kit | null;
  item: Item | null;
  /** Cents. Shirts: Fan, or the one price. */
  fan: number | null;
  /** Cents. Shirts sold as Fan or Player. */
  player: number | null;
  /** Cents. Accessories. */
  cents: number | null;
  stock: Stock;
  hidden: boolean;
  deleted: string | null;
  photos: AdminPhoto[];
  createdAt: string | null;
  /** Built in code (it can't be renamed to a new address). */
  fromCode: boolean;
};

export type AdminTeam = {
  handle: string;
  title: string;
  league: string | null;
  /** Other names it's searched by — "barca", "juve", "ريال". */
  aliases?: string[];
};
export type AdminLeague = { handle: string; title: string };

export type AdminSnapshot = {
  products: AdminProduct[];
  teams: AdminTeam[];
  leagues: AdminLeague[];
  /** Name + number printing, cents. */
  printing: number;
  /** "26/27" — for naming new kits. */
  season: string;
  /** Starting prices for a new product, cents, by kit or item. */
  defaults: Record<Kit | Item, { fan: number; player?: number }>;
  /** Where the editor's data lives: on this computer, or on Netlify. */
  storage: "file" | "netlify";
};

export type ProductInput = {
  /** null: a new product. */
  handle: string | null;
  kind: "shirt" | "printable";
  title: string;
  description: string;
  team: string | null;
  kit: Kit | null;
  item: Item | null;
  fan: number | null;
  player: number | null;
  cents: number | null;
  stock: Stock;
  hidden: boolean;
  photos: { url: string; role?: ImageRole }[];
};

export const KITS: Kit[] = ["Home", "Away", "Third", "Retro", "Long sleeve", "Tracksuit"];
export const ITEMS: Item[] = ["Keychain", "Mug", "Pillow"];
export const hasVersions = (kit: Kit | null) => kit === "Home" || kit === "Away" || kit === "Third";
export const SIZES = ["S", "M", "L", "XL", "XXL"];
export const VERSIONS = ["Fan", "Player"];

export function stockKeysFor(kind: "shirt" | "printable", kit: Kit | null): string[] {
  if (kind === "printable") return ["one"];
  return hasVersions(kit) ? VERSIONS.flatMap((v) => SIZES.map((s) => `${v}/${s}`)) : [...SIZES];
}

/** How many of a product are left, or null when it isn't counted. */
export function stockLeft(p: Pick<AdminProduct, "stock" | "kind" | "kit">): number | null {
  if (!p.stock.track) return null;
  const keys = stockKeysFor(p.kind, p.kit);
  return keys.reduce((n, k) => n + ((p.stock.track && p.stock.qty[k]) || 0), 0);
}

/** Nothing can be bought: every size off, or every count at zero. */
export function soldOut(p: Pick<AdminProduct, "stock" | "kind" | "kit">): boolean {
  const keys = stockKeysFor(p.kind, p.kit);
  if (p.stock.track) return keys.every((k) => !(p.stock.track && p.stock.qty[k] > 0));
  return keys.every((k) => !p.stock.track && (p.stock.off ?? []).includes(k));
}
