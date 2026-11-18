"use server";

import { cookies, headers } from "next/headers";
import { adapter, isShopify } from "./index";
import type { Cart, LineAttributes } from "./types";
import {
  buildOrder,
  lookupOrder,
  recordOrder,
  type OrderDetails,
  type OrderStatus,
} from "./orders";
import {
  AREAS,
  PAYMENT_METHODS,
  deliveryFor,
  type PaymentMethod,
} from "@/lib/contact";
import { formatPrice } from "@/lib/utils";
import { allow, clientIp } from "@/lib/rate-limit";
import { cleanAttributes } from "./attributes";
import { shortages, stockKey, takeStock, type Take } from "./inventory";
import { refreshShop } from "./refresh";

/**
 * Cart mutations run on the server so a Storefront token never reaches the
 * browser. The cart id lives in an httpOnly cookie rather than localStorage
 * for the same reason. On the shop's own backend that id is the cart itself
 * (mock.ts), so it changes with every edit and is written back each time.
 */

const COOKIE = "93plus_cart";
const YEAR = 60 * 60 * 24 * 365;
/** The most of one line anyone buys at once; the cart's stepper stops here too. */
const MAX_QTY = 20;

async function readCartId() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/**
 * Secure only when the request actually arrived over https. Keying this off
 * NODE_ENV made a production build on plain http (a phone on the LAN) drop
 * the cookie silently — every add then started a fresh one-item cart.
 */
async function isHttps() {
  const proto = (await headers()).get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https";
}

async function writeCartId(id: string) {
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    maxAge: YEAR,
    path: "/",
  });
}

async function ensureCart(): Promise<Cart> {
  const id = await readCartId();
  if (id) {
    const existing = await adapter.getCart(id);
    if (existing) return existing;
  }
  const created = await adapter.createCart();
  await writeCartId(created.id);
  return created;
}

const cleanQuantity = (q: unknown) =>
  Math.min(MAX_QTY, Math.max(0, Math.floor(Number(q) || 0)));

const isId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 120;

/** Sixty cart changes a minute per connection: a person never gets near it, a script does. */
async function cartAllowed() {
  return allow(`cart:${await clientIp()}`, 60, 60_000);
}

export async function getCartAction(): Promise<Cart | null> {
  const id = await readCartId();
  return id ? adapter.getCart(id) : null;
}

/** A cart whose id moved on (the cookie cart) is written back. */
async function saved(before: Cart, after: Cart) {
  if (after.id !== before.id) await writeCartId(after.id);
  return after;
}

export async function addToCartAction(
  variantId: string,
  quantity: number,
  attributes: LineAttributes = {},
): Promise<Cart> {
  const cart = await ensureCart();
  const qty = cleanQuantity(quantity);
  if (!isId(variantId) || qty < 1 || !(await cartAllowed())) return cart;
  try {
    return saved(cart, await adapter.addLine(cart.id, variantId, qty, cleanAttributes(attributes)));
  } catch {
    // An unknown variant only arrives from a tampered request: the cart
    // goes back as it was.
    return cart;
  }
}

export async function updateLineAction(
  lineId: string,
  quantity: number,
): Promise<Cart> {
  const cart = await ensureCart();
  if (!isId(lineId) || !(await cartAllowed())) return cart;
  return saved(cart, await adapter.updateLine(cart.id, lineId, cleanQuantity(quantity)));
}

export async function removeLineAction(lineId: string): Promise<Cart> {
  const cart = await ensureCart();
  if (!isId(lineId) || !(await cartAllowed())) return cart;
  return saved(cart, await adapter.removeLine(cart.id, lineId));
}

/**
 * Everything the confirmation screen shows. It's the receipt — people pay a
 * stranger by Whish or OMT on the strength of this screen, so it repeats
 * back exactly what was ordered, what it costs and where it's going.
 */
export type PlacedOrder = {
  number: string;
  placedAt: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  payment: PaymentMethod;
  lines: { title: string; detail: string; quantity: number; price: string }[];
  subtotal: string;
  delivery: string;
  total: string;
};

export type PlaceOrderResult =
  | ({ ok: true } & PlacedOrder)
  | { ok: false; error: string; field?: keyof OrderDetails };

export type PlaceOrderInput = OrderDetails & {
  /**
   * One per checkout screen. A double tap, or a request the network retried,
   * then places one order, not two.
   */
  idempotencyKey?: string;
};

const KEY_RE = /^[\w-]{8,64}$/;
/** Orders in flight or just placed, by cart + key. Fifteen minutes covers any retry. */
const placed = new Map<string, { at: number; result: Promise<PlaceOrderResult> }>();
const PLACED_TTL = 15 * 60_000;

/**
 * Prices come from the server's copy of the cart, never the form — the
 * browser only says who and where. On success the cart cookie is dropped
 * so the next visit starts empty.
 */
export async function placeOrderAction(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const id = await readCartId();
  const key =
    id && typeof input.idempotencyKey === "string" && KEY_RE.test(input.idempotencyKey)
      ? `${id}:${input.idempotencyKey}`
      : null;

  if (key) {
    const seen = placed.get(key);
    if (seen && Date.now() - seen.at < PLACED_TTL) return seen.result;
  }

  const result = placeOrder(id, input);
  if (key) {
    placed.set(key, { at: Date.now(), result });
    // A form sent back for a missing phone must work again with the same key.
    void result.then((r) => {
      if (!r.ok) placed.delete(key);
    });
    if (placed.size > 5000)
      for (const [k, v] of placed) if (Date.now() - v.at > PLACED_TTL) placed.delete(k);
  }
  return result;
}

async function placeOrder(
  id: string | null,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const cart = id ? await adapter.getCart(id) : null;
  if (!cart || cart.lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const details: OrderDetails = {
    name: String(input.name ?? "").trim().slice(0, 80),
    phone: String(input.phone ?? "").trim().slice(0, 30),
    area: String(input.area ?? ""),
    address: String(input.address ?? "").trim().slice(0, 300),
    payment: String(input.payment ?? ""),
    notes: String(input.notes ?? "").trim().slice(0, 300),
  };

  if (details.phone.replace(/\D/g, "").length < 7) {
    return {
      ok: false,
      field: "phone",
      error: "Add a phone number we can call.",
    };
  }
  if (details.name.length < 2) {
    return { ok: false, field: "name", error: "Add your name." };
  }
  if (!(AREAS as readonly string[]).includes(details.area)) {
    return { ok: false, field: "area", error: "Pick your area." };
  }
  if (details.address.length < 5) {
    return {
      ok: false,
      field: "address",
      error: "Add a building, street or landmark.",
    };
  }
  const payment = PAYMENT_METHODS.find((m) => m.id === details.payment);
  if (!payment) {
    return { ok: false, field: "payment", error: "Pick how you'll pay." };
  }
  details.payment = payment.label;

  // Five orders in ten minutes from one connection, 120 a minute from
  // everyone. A customer never meets either; a script filling the order
  // sheet with junk does. Checked after validation so a typo never costs
  // anyone an attempt.
  if (
    !allow(`order:${await clientIp()}`, 5, 10 * 60_000) ||
    !allow("order:all", 120, 60_000)
  ) {
    return {
      ok: false,
      error: "Too many orders from this connection. Try again in a few minutes.",
    };
  }

  // A size can sell out while it sits in someone's cart. Say which, before
  // anything is recorded, so the customer can change it and carry on.
  const takes: Take[] = cart.lines.map((line) => ({
    handle: line.product.handle,
    key: stockKey(line.variant.options),
    quantity: line.quantity,
    title: line.product.title,
    label: [line.variant.options.Version, line.variant.options.Size].filter(Boolean).join(" "),
  }));
  if (!isShopify) {
    const short = await shortages(takes);
    if (short.length) {
      const t = short[0];
      return {
        ok: false,
        error: `Sorry — ${t.title}${t.label ? ` in ${t.label}` : ""} just sold out. Remove it from your cart to carry on.`,
      };
    }
  }

  const order = buildOrder(
    cart,
    details,
    deliveryFor(details.area, cart.subtotal.cents),
  );

  try {
    await recordOrder(order);
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error: "Couldn't place the order. Try again in a moment.",
    };
  }

  // Counted stock goes down; pages showing it are refreshed. The order is
  // already placed, so a hiccup here is logged, never shown to the customer.
  if (!isShopify) {
    try {
      if (await takeStock(takes)) refreshShop();
    } catch (err) {
      console.error(`[stock] ${order.number} placed but stock not updated`, err);
    }
  }

  (await cookies()).delete(COOKIE);

  return {
    ok: true,
    number: order.number,
    placedAt: order.placedAt,
    name: details.name,
    phone: details.phone,
    area: details.area,
    address: details.address,
    payment: payment.id,
    lines: cart.lines.map((line) => ({
      title: line.product.title,
      detail: [
        Object.values(line.variant.options).join(" · ") || "One size",
        [line.attributes.name, line.attributes.number].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" — "),
      quantity: line.quantity,
      price: formatPrice(line.variant.price.cents * line.quantity),
    })),
    subtotal: order.subtotal,
    delivery: order.delivery,
    total: order.total,
  };
}

export type LookupResult = ({ ok: true } & OrderStatus) | { ok: false; error: string };

/**
 * The tracking page. Order numbers are guessable (four random digits a
 * day), so the phone's last four digits are the second key — and even then
 * nothing personal comes back, only status, items and total. Twenty tries a
 * minute per address is plenty for a person and useless for a script.
 */
export async function lookupOrderAction(
  number: string,
  last4: string,
): Promise<LookupResult> {
  const n = String(number ?? "").trim().toUpperCase();
  const p = String(last4 ?? "").replace(/\D/g, "");
  if (!/^93-\d{4}-\d{4}$/.test(n) || p.length !== 4) {
    return { ok: false, error: "Check the order number and the last four digits." };
  }
  if (!allow(`lookup:${await clientIp()}`, 20, 60_000)) {
    return { ok: false, error: "Too many tries. Give it a minute." };
  }
  const order = await lookupOrder(n, p);
  return order
    ? { ok: true, ...order }
    : {
        ok: false,
        error:
          "No order with that number and phone. The receipt is in your cart for two weeks — or ask us on WhatsApp.",
      };
}
