/**
 * 93+ · The editable catalogue
 *
 * `catalogue.ts` is the shop as it was built in code — the factory settings.
 * The shop editor (/admin) never rewrites it. Its changes live in the store
 * as one small document, laid over the code list when the shop is built:
 *
 *   - a product edited in the editor keeps only the edited fields; anything
 *     it never touched (print placement, presets) still comes from code
 *   - a product added in the editor is stored whole, newest first
 *   - a deleted product is a tombstone, so it can be brought back and the
 *     code list can't resurrect it
 *   - teams added in the editor join a league; the printing price is a setting
 *
 * Stock is per product, per size (and per Fan / Player where a kit has both).
 * Untracked stock is "always available", with sizes switched off by hand;
 * tracked stock is a count that every order takes from.
 */

import {
  CATALOGUE,
  LEAGUES,
  PRICES,
  SIZES,
  TEAMS,
  VERSIONS,
  type CatalogueEntry,
  type Item,
  type Kit,
  type ShirtEntry,
} from "./catalogue";
import { cache } from "react";
import { readJSON, update } from "@/lib/store";
import type { ImageRole } from "./types";

export type Stock =
  | { track: false; off?: string[] }
  | { track: true; qty: Record<string, number> };

/**
 * A photo the editor placed. Our own shoots are `/product/<handle>/<file>`
 * (their phone copies and blur are looked up when the shop is built);
 * uploads are `/media/<id>.webp` and carry theirs.
 */
export type StoredPhoto = { url: string; role?: ImageRole; srcSet?: string; blur?: string };

export type Entry = {
  handle: string;
  kind: "shirt" | "printable";
  title: string;
  description: string;
  team?: string;
  kit?: Kit;
  item?: Item;
  /** Shirts: the Fan price, or the one price of a retro / long sleeve / tracksuit. Cents. */
  fan?: number;
  /** Shirts with a Player version. Cents. */
  player?: number;
  /** Accessories. Cents. */
  cents?: number;
  preset?: ShirtEntry["preset"];
  presets?: ShirtEntry["presets"];
  print?: ShirtEntry["print"];
  ucl?: boolean;
  stock?: Stock;
  hidden?: boolean;
  /** When it was deleted (ISO). Deleted products are kept so they can come back. */
  deleted?: string;
  /** Set once the editor has touched the photos; until then they come from disk. */
  photos?: StoredPhoto[];
  createdAt?: string;
  updatedAt?: string;
};

export type CustomTeam = { title: string; league: string };

export type Doc = {
  rev: number;
  updatedAt?: string;
  /** By handle. Over a code product: only what changed. A new product: all of it. */
  products: Record<string, Partial<Entry> & { handle: string }>;
  teams: Record<string, CustomTeam>;
  settings: { printing?: number };
};

const KEY = "catalogue.json";

const emptyDoc = (): Doc => ({ rev: 0, products: {}, teams: {}, settings: {} });

function normalise(doc: Partial<Doc> | null): Doc {
  return {
    rev: doc?.rev ?? 0,
    updatedAt: doc?.updatedAt,
    products: doc?.products ?? {},
    teams: doc?.teams ?? {},
    settings: doc?.settings ?? {},
  };
}

// ── reading ───────────────────────────────────────────────────────────

/**
 * One store read serves every lookup in a request (a page asks for the
 * product, the list and the collections at once) — and no longer: a page
 * rebuilt right after an edit must see the edit, even on another machine.
 */
const readDoc = cache(async (): Promise<Doc> => {
  try {
    return normalise(await readJSON<Doc>(KEY));
  } catch (err) {
    // Building with no route to the store: build from the code list, and the
    // first edit refreshes every page. At runtime a failed read must not
    // replace good pages with the factory list, so it fails the render and
    // the last good page keeps being served.
    if (process.env.NEXT_PHASE !== "phase-production-build") throw err;
    console.warn("[catalogue] store not reachable during the build — using the code catalogue", err);
    return emptyDoc();
  }
});

export const loadDoc = () => readDoc();

/** Fan / Player, sizes — the stock slots a product has. */
export const hasVersions = (kit?: Kit) => kit === "Home" || kit === "Away" || kit === "Third";

export function stockKeys(e: Pick<Entry, "kind" | "kit">): string[] {
  if (e.kind === "printable") return ["one"];
  return hasVersions(e.kit) ? VERSIONS.flatMap((v) => SIZES.map((s) => `${v}/${s}`)) : [...SIZES];
}

/** The stock slot one variant draws on. Blank and printed come off the same shirt. */
export function stockKey(options: Record<string, string>) {
  const size = options.Size;
  if (!size) return "one";
  return options.Version ? `${options.Version}/${size}` : size;
}

export function inStock(stock: Stock | undefined, key: string) {
  if (!stock || !stock.track) return !stock?.off?.includes(key);
  return (stock.qty[key] ?? 0) > 0;
}

function fromCode(e: CatalogueEntry): Entry {
  if (e.kind === "printable")
    return {
      handle: e.handle,
      kind: "printable",
      title: e.title,
      description: e.description,
      team: e.team,
      item: e.item,
      cents: e.cents,
    };
  const keys = stockKeys({ kind: "shirt", kit: e.kit });
  const off = e.soldOut
    ? keys
    : e.soldOutSizes
      ? keys.filter((k) => e.soldOutSizes!.includes(k.split("/").pop()!))
      : [];
  return {
    handle: e.handle,
    kind: "shirt",
    title: e.title,
    description: e.description,
    team: e.team,
    kit: e.kit,
    fan: e.fan,
    player: e.player,
    preset: e.preset,
    presets: e.presets,
    print: e.print,
    ucl: e.ucl,
    ...(off.length ? { stock: { track: false as const, off } } : {}),
  };
}

const CODE: Entry[] = CATALOGUE.map(fromCode);
export const CODE_HANDLES = new Set(CODE.map((e) => e.handle));
/** A product as the code list has it, before any edit. */
export const codeEntry = (handle: string) => CODE.find((e) => e.handle === handle);

const complete = (s: Partial<Entry>): s is Entry =>
  Boolean(s.handle && s.kind && s.title && (s.kind === "shirt" ? s.kit : s.item));

/** Every product, editor's changes applied — hidden and deleted ones included. */
export function entriesOf(doc: Doc): Entry[] {
  const merged = CODE.map((e) => {
    const edit = doc.products[e.handle];
    return edit ? { ...e, ...edit } : e;
  });
  const added = Object.values(doc.products)
    .filter((s) => !CODE_HANDLES.has(s.handle))
    .filter(complete)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return [...added, ...merged];
}

/** Team handle → name, the editor's new teams included. */
export function teamsOf(doc: Doc): Record<string, string> {
  return {
    ...TEAMS,
    ...Object.fromEntries(Object.entries(doc.teams).map(([h, t]) => [h, t.title])),
  };
}

export function leaguesOf(doc: Doc) {
  return LEAGUES.map((league) => ({
    ...league,
    teams: [
      ...(league.teams as string[]),
      ...Object.entries(doc.teams)
        .filter(([, t]) => t.league === league.handle)
        .map(([h]) => h),
    ],
  }));
}

export const printingOf = (doc: Doc) => doc.settings.printing ?? PRICES.printing;

// ── writing ───────────────────────────────────────────────────────────

/** Every change to the catalogue goes through here: read, change, write, bump. */
export async function mutate(change: (doc: Doc) => void): Promise<Doc> {
  const next = await update<Doc>(KEY, (current) => {
    const doc = normalise(current);
    change(doc);
    doc.rev += 1;
    doc.updatedAt = new Date().toISOString();
    return doc;
  });
  return next;
}

/** One line of an order, in stock terms. */
export type Take = { handle: string; key: string; quantity: number; title: string; label: string };

/** Lines the stock can't cover right now — a size that sold out while it sat in a cart. */
export async function shortages(takes: Take[]): Promise<Take[]> {
  const doc = await loadDoc();
  const entries = new Map(entriesOf(doc).map((e) => [e.handle, e]));
  const needed = new Map<string, number>();
  for (const t of takes) needed.set(`${t.handle}|${t.key}`, (needed.get(`${t.handle}|${t.key}`) ?? 0) + t.quantity);
  return takes.filter((t) => {
    const e = entries.get(t.handle);
    if (!e || e.hidden || e.deleted) return true;
    if (!e.stock?.track) return !inStock(e.stock, t.key);
    return (e.stock.qty[t.key] ?? 0) < needed.get(`${t.handle}|${t.key}`)!;
  });
}

/** Takes an order out of the counted stock. True if anything was counted. */
export async function takeStock(takes: Take[]): Promise<boolean> {
  const doc = await loadDoc();
  const tracked = new Set(
    entriesOf(doc)
      .filter((e) => e.stock?.track)
      .map((e) => e.handle),
  );
  const counted = takes.filter((t) => tracked.has(t.handle));
  if (!counted.length) return false;
  await mutate((d) => {
    const entries = new Map(entriesOf(d).map((e) => [e.handle, e]));
    for (const t of counted) {
      const e = entries.get(t.handle);
      if (!e?.stock?.track) continue;
      const qty = { ...e.stock.qty, [t.key]: Math.max(0, (e.stock.qty[t.key] ?? 0) - t.quantity) };
      const stock: Stock = { track: true, qty };
      d.products[t.handle] = { ...(d.products[t.handle] ?? { handle: t.handle }), stock };
      e.stock = stock;
    }
  });
  return true;
}
