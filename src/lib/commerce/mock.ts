/**
 * The shop's own backend — builds the products from the catalogue (code
 * list + the shop editor's changes, `./inventory`) and keeps carts in a
 * cookie.
 *
 * Replaced wholesale by the Shopify adapter once its env vars are set.
 * Shapes are identical.
 */

import { createHash } from "node:crypto";
import {
  CUSTOM,
  PRICES,
  SET_CONTENTS,
  SIZES,
  TRACKSUIT_CONTENTS,
  VERSIONS,
  shirtPricing,
  type Kit,
} from "./catalogue";
import {
  categoriesOf,
  collectionsFor,
  entriesOf,
  inStock,
  loadDoc,
  printingOf,
  stockKey,
  teamsOf,
  type Doc,
  type Entry,
} from "./inventory";
import { imagesFor } from "./photos";
import { cleanAttributes } from "./attributes";
import type {
  Cart,
  CartLine,
  Collection,
  CommerceAdapter,
  LineAttributes,
  Money,
  Product,
  Variant,
} from "./types";

const USD = (cents: number): Money => ({ cents, currency: "USD" });

const variantId = (...parts: string[]) =>
  parts.join("--").toLowerCase().replace(/[^a-z0-9-]+/g, "-");

const CATEGORY: Record<Kit, string> = {
  Home: "Shirt",
  Away: "Shirt",
  Third: "Shirt",
  Retro: "Retro shirt",
  "Long sleeve": "Long sleeve",
  Tracksuit: "Tracksuit",
};

function buildShirt(seed: Entry, printing: number): Product {
  const kit = seed.kit ?? "Home";
  const pricing = shirtPricing({ kit, fan: seed.fan, player: seed.player }, printing);
  const variants: Variant[] = [];
  // Retros, long sleeves and tracksuits have no Fan/Player choice.
  for (const version of pricing.versions.length ? pricing.versions : [undefined]) {
    for (const size of SIZES) {
      for (const custom of CUSTOM) {
        const options = {
          ...(version ? { Version: version } : {}),
          Size: size,
          Customisation: custom,
        };
        variants.push({
          id: variantId(seed.handle, ...(version ? [version] : []), size, custom),
          title: [version, size, custom].filter(Boolean).join(" / "),
          available: inStock(seed.stock, stockKey(options)),
          price: USD(pricing.base(version) + (custom === "Blank" ? 0 : pricing.printing)),
          options,
        });
      }
    }
  }
  const cents = variants.map((v) => v.price.cents);
  const preset = seed.preset ?? seed.presets?.[0];

  return {
    id: seed.handle,
    handle: seed.handle,
    title: seed.title,
    description: seed.description,
    images: imagesFor(seed),
    options: [
      ...(pricing.versions.length ? [{ name: "Version", values: VERSIONS }] : []),
      { name: "Size", values: SIZES },
      { name: "Customisation", values: CUSTOM },
    ],
    variants,
    priceRange: { min: USD(Math.min(...cents)), max: USD(Math.max(...cents)) },
    available: variants.some((v) => v.available),
    category: CATEGORY[kit],
    customisable: true,
    set: kit === "Tracksuit" ? TRACKSUIT_CONTENTS : SET_CONTENTS,
    preset,
    presets: seed.presets,
    print: seed.print,
    collections: collectionsFor(seed),
  };
}

function buildPrintable(seed: Entry): Product {
  const item = seed.item ?? "Keychain";
  const cents = seed.cents ?? PRICES[item];
  const available = inStock(seed.stock, "one");
  return {
    id: seed.handle,
    handle: seed.handle,
    title: seed.title,
    description: seed.description,
    images: imagesFor(seed),
    options: [],
    variants: [
      {
        id: variantId(seed.handle, "default"),
        title: "Default",
        available,
        price: USD(cents),
        options: {},
      },
    ],
    priceRange: { min: USD(cents), max: USD(cents) },
    available,
    category: item,
    customisable: false,
    collections: collectionsFor(seed),
  };
}

function buildShop(doc: Doc) {
  const printing = printingOf(doc);
  const products: Product[] = entriesOf(doc)
    .filter((e) => !e.hidden && !e.deleted)
    .map((e) => (e.kind === "shirt" ? buildShirt(e, printing) : buildPrintable(e)));
  const membersOf = (handle: string) =>
    products.filter((p) => p.collections?.includes(handle));

  /** Collections are derived from the products, so counts are always true. */
  const toCollection = (
    handle: string,
    title: string,
    kind: Collection["kind"],
  ): Collection | null => {
    const members = membersOf(handle);
    if (!members.length) return null;
    // Always the cold front — the hot frame belongs to hover, nowhere else.
    return { handle, title, kind, image: members[0].images[0], count: members.length };
  };

  const collections: Collection[] = [
    ...Object.entries(teamsOf(doc)).map(([handle, title]) =>
      toCollection(handle, title, "team"),
    ),
    ...categoriesOf(doc).map(([handle, title]) => toCollection(handle, title, "category")),
  ].filter((c): c is Collection => c !== null);

  const variants = new Map<string, { product: Product; variant: Variant }>();
  for (const product of products)
    for (const variant of product.variants) variants.set(variant.id, { product, variant });

  return { products, collections, membersOf, variants };
}

/**
 * Rebuilt whenever the catalogue changes (an edit bumps its `rev`). In dev
 * also every couple of seconds, because photos are read from disk and a new
 * shoot should show without a restart.
 */
let built: { rev: number; doc: Doc; at: number; shop: ReturnType<typeof buildShop> } | null = null;

async function shop() {
  const doc = await loadDoc();
  const stale =
    !built ||
    built.rev !== doc.rev ||
    built.doc.updatedAt !== doc.updatedAt ||
    (process.env.NODE_ENV !== "production" && Date.now() - built.at > 2000);
  if (stale) built = { rev: doc.rev, doc, at: Date.now(), shop: buildShop(doc) };
  return built!.shop;
}

// ── carts, in a cookie ───────────────────────────────────────────────
//
// A hosted server doesn't keep memory between requests (each may land on a
// fresh machine), and a restart used to empty every cart. So the cart lives
// in the browser's cookie: the cart "id" IS the cart — variant, quantity and
// print for each line, nothing else. Prices, titles and availability are
// looked up fresh every time, so a tampered cookie can only ask for things
// the shop sells, at the shop's prices.

type Packed = [variantId: string, quantity: number, name?: string, number?: string];

const PREFIX = "c.";
/** Lines and quantities are capped; the cart's own stepper stops at 20. */
const MAX_LINES = 30;
const MAX_QTY = 20;
/** Browsers drop a cookie past ~4 KB. */
const MAX_COOKIE = 3800;

const pack = (lines: Packed[]) =>
  PREFIX + Buffer.from(JSON.stringify(lines)).toString("base64url");

function unpack(id: string): Packed[] | null {
  if (!id.startsWith(PREFIX)) return null;
  try {
    const raw = JSON.parse(Buffer.from(id.slice(PREFIX.length), "base64url").toString("utf8"));
    if (!Array.isArray(raw)) return null;
    return raw
      .filter(
        (l): l is Packed =>
          Array.isArray(l) &&
          typeof l[0] === "string" &&
          l[0].length <= 120 &&
          Number.isInteger(l[1]) &&
          l[1] > 0,
      )
      .slice(0, MAX_LINES)
      .map(([v, q, n, u]) => [v, Math.min(MAX_QTY, q), ...printOf(n, u)] as Packed);
  } catch {
    return null;
  }
}

/** The print, cleaned, as the tail of a packed line — nothing when blank. */
function printOf(name: unknown, number: unknown): [string, string] | [] {
  const a = cleanAttributes({ name: String(name ?? ""), number: String(number ?? "") });
  return a.name || a.number ? [a.name ?? "", a.number ?? ""] : [];
}

/** Same variant + same print is one line, with a stable id the cart UI can address. */
const lineKey = ([v, , n, u]: Packed) =>
  "l" + createHash("sha1").update(`${v}|${n ?? ""}|${u ?? ""}`).digest("base64url").slice(0, 10);

async function materialise(packed: Packed[]): Promise<Cart> {
  const { variants } = await shop();
  const lines: CartLine[] = [];
  const kept: Packed[] = [];
  for (const line of packed) {
    const found = variants.get(line[0]);
    if (!found) continue; // gone from the shop since it was added
    const id = lineKey(line);
    const same = lines.find((l) => l.id === id);
    if (same) {
      same.quantity = Math.min(MAX_QTY, same.quantity + line[1]);
      kept.find((k) => lineKey(k) === id)![1] = same.quantity;
      continue;
    }
    const attributes: LineAttributes = {
      ...(line[2] && { name: line[2] }),
      ...(line[3] && { number: line[3] }),
    };
    lines.push({
      id,
      quantity: line[1],
      variant: found.variant,
      product: {
        handle: found.product.handle,
        title: found.product.title,
        images: found.product.images,
      },
      attributes,
    });
    kept.push(line);
  }
  return {
    id: pack(kept),
    lines,
    totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: USD(lines.reduce((n, l) => n + l.variant.price.cents * l.quantity, 0)),
    checkoutUrl: "#checkout",
  };
}

export const mockAdapter: CommerceAdapter = {
  async getProducts() {
    return (await shop()).products;
  },

  async getCollections(kind) {
    return (await shop()).collections.filter((c) => c.kind === kind);
  },

  async getCollectionProducts(handle) {
    return (await shop()).membersOf(handle);
  },

  async getProduct(handle) {
    return (await shop()).products.find((p) => p.handle === handle) ?? null;
  },

  async createCart() {
    return materialise([]);
  },

  async getCart(id) {
    const packed = unpack(id);
    return packed ? materialise(packed) : null;
  },

  async addLine(cartId, variantId, quantity, attributes: LineAttributes = {}) {
    const packed = unpack(cartId) ?? [];
    if (!(await shop()).variants.has(variantId)) throw new Error(`Unknown variant: ${variantId}`);
    const line: Packed = [variantId, Math.min(MAX_QTY, quantity), ...printOf(attributes.name, attributes.number)];
    const existing = packed.find((l) => lineKey(l) === lineKey(line));
    if (existing) existing[1] = Math.min(MAX_QTY, existing[1] + line[1]);
    else if (packed.length < MAX_LINES && pack([...packed, line]).length <= MAX_COOKIE) packed.push(line);
    return materialise(packed);
  },

  async updateLine(cartId, lineId, quantity) {
    const packed = unpack(cartId);
    if (!packed) throw new Error("No cart");
    const line = packed.find((l) => lineKey(l) === lineId);
    const next =
      line && quantity <= 0
        ? packed.filter((l) => l !== line)
        : packed.map((l) => (l === line ? ([l[0], Math.min(MAX_QTY, quantity), ...l.slice(2)] as Packed) : l));
    return materialise(next);
  },

  async removeLine(cartId, lineId) {
    const packed = unpack(cartId);
    if (!packed) throw new Error("No cart");
    return materialise(packed.filter((l) => lineKey(l) !== lineId));
  },
};
