/**
 * 93+ · Commerce domain types
 *
 * Nothing in the UI imports a Shopify SDK. Everything goes through the
 * adapter in `./index`, which normalises whatever the backend returns
 * into these shapes. Swapping the backend is a change to one module.
 *
 * Money is integer minor units — Shopify hands back decimal strings and
 * the adapter converts, so no float arithmetic ever reaches the UI.
 */

export type Money = { cents: number; currency: string };

export type ProductImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
  /**
   * What the frame is for, read off its filename (`03-back.webp`). A full
   * shoot is front · hover · back · detail. Two-photo products leave it
   * unset and their second frame does both jobs.
   */
  role?: ImageRole;
  /**
   * No photo yet — render a typeset stand-in instead (`ProductPhoto`).
   * `alt` then carries the product title the stand-in prints.
   */
  placeholder?: "front" | "back";
  /** Tiny blurred copy as a data URL — painted while the real photo loads. */
  blur?: string;
  /** Smaller copies for a srcset ("…-432.webp 432w, …-648.webp 648w, … 864w"). Our own photos only. */
  srcSet?: string;
};

export type ImageRole = "front" | "hover" | "back" | "detail";

const ROLES: ImageRole[] = ["front", "hover", "back", "detail"];

/** `…/03-back.webp?v=2` → "back". Same rule on disk and on Shopify's CDN. */
export function roleFromUrl(url: string): ImageRole | undefined {
  const name = url.split("?")[0].split("/").pop()?.toLowerCase() ?? "";
  return ROLES.find((r) => new RegExp(`(^|[^a-z])${r}([^a-z]|$)`).test(name));
}

/** The hot frame the card swipes in on hover. */
export const hoverOf = (images: ProductImage[]) =>
  images.find((i) => i.role === "hover") ?? images[1];

/** The flat, straight-on back the name + number preview prints on. */
export const backOf = (images: ProductImage[]) =>
  images.find((i) => i.role === "back") ?? images[1];

/**
 * Where the name + number sit on a back photo: tops in % of height, sizes
 * and the centre line in container-query units (cqw).
 */
export type PrintPlacement = {
  nameTop: number;
  nameSize: number;
  numberTop: number;
  numberSize: number;
  /** Centre line of the print, % of width. 50 unless the shirt hangs off-centre. */
  centre?: number;
  /**
   * Print colour for dark kits (white on red, gold on stripes). Multiply can
   * only darken, so a light ink is laid on instead, a touch under full strength.
   */
  lightInk?: string;
  /**
   * CSS blend mode for the print. `difference` with white ink inverts whatever
   * is underneath, so one print reads on a half-white, half-black shirt.
   */
  blend?: string;
};

/** Front + back stand-ins for a product with no photos. */
export const placeholderImages = (title: string): ProductImage[] =>
  (["front", "back"] as const).map((face) => ({
    url: "",
    width: 1280,
    height: 1714,
    alt: title,
    placeholder: face,
  }));

/** Mirrors Shopify's 3-option cap: Version · Size · Customisation. */
export type ProductOption = {
  name: string;
  values: string[];
};

export type Variant = {
  id: string;
  title: string;
  available: boolean;
  price: Money;
  /** { Version: "Player", Size: "L", Customisation: "Name + Number" } */
  options: Record<string, string>;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  /**
   * By convention [0] is the front and [1] the hover/back. A full shoot adds
   * a separate back and a detail — use `hoverOf` / `backOf`, not indexes.
   * Same as Shopify's order.
   */
  images: ProductImage[];
  options: ProductOption[];
  variants: Variant[];
  priceRange: { min: Money; max: Money };
  available: boolean;
  category: string;
  /** Shirts take a name and number; accessories don't. */
  customisable: boolean;
  /** What's in the box when it's more than the photo shows — "Shirt + shorts". */
  set?: string;
  /** Gets a double-width cell in the grid. */
  featured?: boolean;
  /** Pre-filled name + number — "RONALDO 7" on the retro shirts. */
  preset?: { name: string; number: string };
  /** A choice of pre-printed players — the buyer picks one. First = default. */
  presets?: { name: string; number: string }[];
  /** Print placement for this shirt's back photo. Unset → the stand-in's. */
  print?: PrintPlacement;
  /** Collection handles this product belongs to. */
  collections?: string[];
};

/** Free-text personalisation. Line-item properties, never variants. */
export type LineAttributes = {
  name?: string;
  number?: string;
};

export type CartLine = {
  id: string;
  quantity: number;
  variant: Variant;
  product: Pick<Product, "handle" | "title" | "images">;
  attributes: LineAttributes;
};

export type Cart = {
  id: string;
  lines: CartLine[];
  totalQuantity: number;
  subtotal: Money;
  /** Shopify's hosted checkout. The design ends here. */
  checkoutUrl: string;
};

/**
 * Teams and categories are the two ways people actually navigate a shirt
 * shop — you arrive knowing your club, or knowing you want a scarf. Both
 * map onto Shopify collections, so this shape survives the swap.
 */
export type Collection = {
  handle: string;
  title: string;
  kind: "team" | "category";
  image: ProductImage;
  count: number;
};

/** A league is a set of team collections, most famous club first. */
export type League = {
  handle: string;
  title: string;
  teams: Collection[];
};

/** One row of the search index — just enough to draw a result. */
export type SearchItem = {
  handle: string;
  title: string;
  price: string;
  category: string;
  image: ProductImage;
  /** Lower-cased words the item answers to: team, league, aliases, kit. */
  keywords: string;
};

export interface CommerceAdapter {
  getProducts(): Promise<Product[]>;
  getCollections(kind: Collection["kind"]): Promise<Collection[]>;
  getCollectionProducts(handle: string): Promise<Product[]>;
  getProduct(handle: string): Promise<Product | null>;
  createCart(): Promise<Cart>;
  getCart(id: string): Promise<Cart | null>;
  addLine(
    cartId: string,
    variantId: string,
    quantity: number,
    attributes?: LineAttributes,
  ): Promise<Cart>;
  updateLine(cartId: string, lineId: string, quantity: number): Promise<Cart>;
  removeLine(cartId: string, lineId: string): Promise<Cart>;
}

/** Free delivery threshold, in minor units. Drives the cart progress bar. */
export const FREE_SHIPPING_CENTS = 5000;
