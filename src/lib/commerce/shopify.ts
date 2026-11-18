/**
 * Shopify backend — Storefront API.
 *
 * Switched on automatically by `./index` when SHOPIFY_STORE_DOMAIN and
 * SHOPIFY_STOREFRONT_TOKEN are set. Everything is normalised into the
 * shapes in `./types`, so the UI never learns which backend it's on.
 *
 * Conventions this expects in the store (all produced by
 * `scripts/shopify-csv.mts` + the collection setup in SHOPIFY.md):
 *   - tags carry collection handles; collections are tag-rule smart
 *     collections with matching handles
 *   - shirts have the options Version · Size · Customisation
 *   - a `preset:NAME:NUMBER` tag pre-fills the personalisation fields
 *   - name + number travel as cart line attributes "Name" and "Number"
 */

import { BEST_SELLERS, CATEGORIES, SET_CONTENTS } from "./catalogue";
import type {
  Cart,
  CartLine,
  Collection,
  CommerceAdapter,
  LineAttributes,
  Money,
  Product,
  ProductImage,
  Variant,
} from "./types";
import { placeholderImages, roleFromUrl } from "./types";

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

/** Collections that exist in every store but aren't teams. */
const HIDDEN = new Set(["frontpage", "all", BEST_SELLERS]);
const CATEGORY_HANDLES = new Set(CATEGORIES.map(([handle]) => handle));

// ── transport ────────────────────────────────────────────────────────

type Gql = { data?: unknown; errors?: { message: string }[] };

async function shopify<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { cache = false }: { cache?: boolean } = {},
): Promise<T> {
  if (!DOMAIN || !TOKEN) throw new Error("Shopify env vars are not set");
  const res = await fetch(`https://${DOMAIN}/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    // Catalogue reads refresh every minute; carts are always live.
    ...(cache ? { next: { revalidate: 60 } } : { cache: "no-store" as const }),
  });
  const json = (await res.json()) as Gql;
  if (!res.ok || json.errors?.length)
    throw new Error(
      `Shopify ${res.status}: ${json.errors?.map((e) => e.message).join("; ") ?? res.statusText}`,
    );
  return json.data as T;
}

// ── normalisers ──────────────────────────────────────────────────────

type ShMoney = { amount: string; currencyCode: string };
type ShImage = { url: string; width: number; height: number; altText: string | null };
type ShVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: ShMoney;
  selectedOptions: { name: string; value: string }[];
};
type ShProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  options: { name: string; optionValues: { name: string }[] }[];
  images: { nodes: ShImage[] };
  variants: { nodes: ShVariant[] };
  priceRange: { minVariantPrice: ShMoney; maxVariantPrice: ShMoney };
  collections: { nodes: { handle: string }[] };
};

/** Decimal strings → integer minor units, once, at the edge. */
const money = (m: ShMoney): Money => ({
  cents: Math.round(parseFloat(m.amount) * 100),
  currency: m.currencyCode,
});

const image = (i: ShImage): ProductImage => ({
  url: i.url,
  width: i.width,
  height: i.height,
  alt: i.altText ?? "",
  role: roleFromUrl(i.url),
});

const variant = (v: ShVariant): Variant => ({
  id: v.id,
  title: v.title,
  available: v.availableForSale,
  price: money(v.price),
  options: Object.fromEntries(v.selectedOptions.map((o) => [o.name, o.value])),
});

function product(p: ShProduct): Product {
  // Shopify gives option-less products a single "Title: Default Title".
  const options = p.options
    .filter((o) => !(o.name === "Title" && o.optionValues.length === 1))
    .map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) }));
  const presetTag = p.tags.find((t) => t.startsWith("preset:"));
  const [, presetName, presetNumber] = presetTag?.split(":") ?? [];

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    images: p.images.nodes.length
      ? p.images.nodes.map(image)
      : placeholderImages(p.title),
    options,
    variants: p.variants.nodes.map(variant).map((v) =>
      options.length ? v : { ...v, options: {} },
    ),
    priceRange: {
      min: money(p.priceRange.minVariantPrice),
      max: money(p.priceRange.maxVariantPrice),
    },
    available: p.availableForSale,
    category: p.productType || "Product",
    customisable: options.some((o) => o.name === "Customisation"),
    set: options.some((o) => o.name === "Customisation") ? SET_CONTENTS : undefined,
    featured: p.tags.includes("featured"),
    preset: presetName ? { name: presetName, number: presetNumber ?? "" } : undefined,
    collections: p.collections.nodes.map((c) => c.handle),
  };
}

const PRODUCT = /* GraphQL */ `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    productType
    tags
    availableForSale
    options { name optionValues { name } }
    images(first: 10) { nodes { url width height altText } }
    variants(first: 100) {
      nodes {
        id
        title
        availableForSale
        price { amount currencyCode }
        selectedOptions { name value }
      }
    }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    collections(first: 20) { nodes { handle } }
  }
`;

const CART = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        attributes { key value }
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            price { amount currencyCode }
            selectedOptions { name value }
            product {
              handle
              title
              images(first: 2) { nodes { url width height altText } }
            }
          }
        }
      }
    }
  }
`;

type ShCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: ShMoney };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      attributes: { key: string; value: string | null }[];
      merchandise: ShVariant & {
        product: { handle: string; title: string; images: { nodes: ShImage[] } };
      };
    }[];
  };
};

function cart(c: ShCart): Cart {
  const lines: CartLine[] = c.lines.nodes.map((l) => {
    const attr = (key: string) =>
      l.attributes.find((a) => a.key === key)?.value ?? undefined;
    const v = variant(l.merchandise);
    return {
      id: l.id,
      quantity: l.quantity,
      variant: v.title === "Default Title" ? { ...v, options: {} } : v,
      product: {
        handle: l.merchandise.product.handle,
        title: l.merchandise.product.title,
        images: l.merchandise.product.images.nodes.length
          ? l.merchandise.product.images.nodes.map(image)
          : placeholderImages(l.merchandise.product.title),
      },
      attributes: { name: attr("Name"), number: attr("Number") },
    };
  });
  return {
    id: c.id,
    lines,
    totalQuantity: c.totalQuantity,
    subtotal: money(c.cost.subtotalAmount),
    checkoutUrl: c.checkoutUrl,
  };
}

function lineAttributes(a: LineAttributes) {
  return [
    a.name && { key: "Name", value: a.name },
    a.number && { key: "Number", value: a.number },
  ].filter(Boolean);
}

type CartPayload = { cart: ShCart | null; userErrors: { message: string }[] };

function unwrap(payload: CartPayload): Cart {
  if (payload.userErrors.length)
    throw new Error(payload.userErrors.map((e) => e.message).join("; "));
  if (!payload.cart) throw new Error("Shopify returned no cart");
  return cart(payload.cart);
}

// ── adapter ──────────────────────────────────────────────────────────

export const shopifyAdapter: CommerceAdapter = {
  async getProducts() {
    const data = await shopify<{ products: { nodes: ShProduct[] } }>(
      `${PRODUCT} query { products(first: 250) { nodes { ...ProductFields } } }`,
      {},
      { cache: true },
    );
    return data.products.nodes.map(product);
  },

  async getProduct(handle) {
    const data = await shopify<{ product: ShProduct | null }>(
      `${PRODUCT} query ($handle: String!) { product(handle: $handle) { ...ProductFields } }`,
      { handle },
      { cache: true },
    );
    return data.product ? product(data.product) : null;
  },

  async getCollectionProducts(handle) {
    const data = await shopify<{
      collection: { products: { nodes: ShProduct[] } } | null;
    }>(
      `${PRODUCT} query ($handle: String!) {
        collection(handle: $handle) {
          products(first: 250) { nodes { ...ProductFields } }
        }
      }`,
      { handle },
      { cache: true },
    );
    return data.collection?.products.nodes.map(product) ?? [];
  },

  async getCollections(kind) {
    const data = await shopify<{
      collections: {
        nodes: {
          handle: string;
          title: string;
          image: ShImage | null;
          products: { nodes: { images: { nodes: ShImage[] } }[] };
        }[];
      };
    }>(
      `query {
        collections(first: 100) {
          nodes {
            handle
            title
            image { url width height altText }
            products(first: 250) {
              nodes { images(first: 2) { nodes { url width height altText } } }
            }
          }
        }
      }`,
      {},
      { cache: true },
    );

    const order = CATEGORIES.map(([h]) => h);
    const collections: Collection[] = data.collections.nodes
      .filter((c) => !HIDDEN.has(c.handle) && c.products.nodes.length > 0)
      .map((c) => {
        const isCategory = CATEGORY_HANDLES.has(c.handle);
        // The cold front — the hot frame belongs to hover, nowhere else.
        const cover = c.image ?? c.products.nodes[0].images.nodes[0];
        return {
          handle: c.handle,
          title: c.title,
          kind: isCategory ? ("category" as const) : ("team" as const),
          image: cover ? image(cover) : placeholderImages(c.title)[0],
          count: c.products.nodes.length,
        };
      })
      .filter((c) => c.kind === kind);

    // Categories keep the rail order from the catalogue.
    return kind === "category"
      ? collections.sort((a, b) => order.indexOf(a.handle) - order.indexOf(b.handle))
      : collections;
  },

  async createCart() {
    const data = await shopify<{ cartCreate: CartPayload }>(
      `${CART} mutation { cartCreate { cart { ...CartFields } userErrors { message } } }`,
    );
    return unwrap(data.cartCreate);
  },

  async getCart(id) {
    const data = await shopify<{ cart: ShCart | null }>(
      `${CART} query ($id: ID!) { cart(id: $id) { ...CartFields } }`,
      { id },
    );
    return data.cart ? cart(data.cart) : null;
  },

  async addLine(cartId, merchandiseId, quantity, attributes = {}) {
    const data = await shopify<{ cartLinesAdd: CartPayload }>(
      `${CART} mutation ($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart { ...CartFields } userErrors { message }
        }
      }`,
      {
        cartId,
        lines: [{ merchandiseId, quantity, attributes: lineAttributes(attributes) }],
      },
    );
    return unwrap(data.cartLinesAdd);
  },

  async updateLine(cartId, id, quantity) {
    if (quantity <= 0) return shopifyAdapter.removeLine(cartId, id);
    const data = await shopify<{ cartLinesUpdate: CartPayload }>(
      `${CART} mutation ($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { ...CartFields } userErrors { message }
        }
      }`,
      { cartId, lines: [{ id, quantity }] },
    );
    return unwrap(data.cartLinesUpdate);
  },

  async removeLine(cartId, lineId) {
    const data = await shopify<{ cartLinesRemove: CartPayload }>(
      `${CART} mutation ($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { ...CartFields } userErrors { message }
        }
      }`,
      { cartId, lineIds: [lineId] },
    );
    return unwrap(data.cartLinesRemove);
  },
};
