import { formatPrice } from "@/lib/utils";
import { readJSON, update } from "@/lib/store";
import { stockKey } from "./inventory";
import type { Cart } from "./types";

/**
 * 93+ · Orders
 *
 * Every order lives in the shop's own store (`orders.json`, src/lib/store.ts)
 * and is run from the shop editor's Orders room: its status there is what the
 * customer's tracking page (/order) shows.
 *
 * A Google Sheet can get a copy of each new order as well (ORDERS_WEBHOOK_URL,
 * scripts/orders-sheet.gs, ORDERS.md) — handy for a spreadsheet view. The
 * order still counts as placed only once the store has it.
 */

export type OrderDetails = {
  name: string;
  phone: string;
  area: string;
  address: string;
  payment: string;
  notes: string;
};

/** The steps an order walks through, in order. Cancelled can happen at any point. */
export const ORDER_STEPS = ["New", "Confirmed", "Paid", "Out for delivery", "Delivered"] as const;
export type OrderState = (typeof ORDER_STEPS)[number] | "Cancelled";
export const ORDER_STATES: OrderState[] = [...ORDER_STEPS, "Cancelled"];

/** One line of an order, kept whole so the editor can show it and put stock back. */
export type OrderLine = {
  handle: string;
  title: string;
  /** { Version: "Fan", Size: "M", Customisation: "Name + Number" } */
  options: Record<string, string>;
  /** "MESSI 10" */
  print?: string;
  quantity: number;
  /** Each, in cents. */
  priceCents: number;
  /** The stock slot it came from ("Fan/M"). */
  key: string;
};

export type Order = OrderDetails & {
  number: string;
  placedAt: string;
  items: string;
  subtotal: string;
  delivery: string;
  total: string;
  totalCents: number;
  lines?: OrderLine[];
  status?: OrderState;
  /** When each status was set. */
  history?: { status: OrderState; at: string }[];
  /** Counted stock was returned when it was cancelled. */
  restocked?: boolean;
};

type OrdersDoc = { orders: Order[] };
const KEY = "orders.json";

/** "93-1009-4817": prefix, month+day, four random digits. Readable on the phone. */
function orderNumber(date: Date) {
  const md =
    `${date.getMonth() + 1}`.padStart(2, "0") +
    `${date.getDate()}`.padStart(2, "0");
  const tail = Math.floor(1000 + Math.random() * 9000);
  return `93-${md}-${tail}`;
}

const printOf = (a: { name?: string; number?: string }) =>
  [a.name, a.number].filter(Boolean).join(" ");

/** One line per item — readable in a single spreadsheet cell. */
function itemsText(cart: Cart) {
  return cart.lines
    .map((line) => {
      const opts =
        Object.values(line.variant.options).join(" · ") || "One size";
      const print = printOf(line.attributes);
      return `${line.quantity}× ${line.product.title} — ${opts}${print ? ` — Print: ${print}` : ""}`;
    })
    .join("\n");
}

export function buildOrder(
  cart: Cart,
  details: OrderDetails,
  deliveryCents: number,
): Order {
  const now = new Date();
  const totalCents = cart.subtotal.cents + deliveryCents;
  return {
    ...details,
    number: orderNumber(now),
    placedAt: now.toISOString(),
    items: itemsText(cart),
    subtotal: formatPrice(cart.subtotal.cents),
    delivery: deliveryCents ? formatPrice(deliveryCents) : "Free",
    total: formatPrice(totalCents),
    totalCents,
    lines: cart.lines.map((line) => ({
      handle: line.product.handle,
      title: line.product.title,
      options: line.variant.options,
      ...(printOf(line.attributes) && { print: printOf(line.attributes) }),
      quantity: line.quantity,
      priceCents: line.variant.price.cents,
      key: stockKey(line.variant.options),
    })),
    status: "New",
    history: [{ status: "New", at: now.toISOString() }],
  };
}

export async function recordOrder(order: Order) {
  // The store is the order book; this is the write that has to land.
  await update<OrdersDoc>(KEY, (doc) => {
    const orders = doc?.orders ?? [];
    // Four random digits a day: a clash is rare, and never overwrites.
    while (orders.some((o) => o.number === order.number))
      order.number = `${order.number.slice(0, 8)}${Math.floor(1000 + Math.random() * 9000)}`;
    return { orders: [order, ...orders] };
  });

  const url = process.env.ORDERS_WEBHOOK_URL;
  if (!url) return;
  // The sheet is a copy. If it's down, the order is still placed.
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.ORDERS_WEBHOOK_SECRET ?? "", order }),
      // Apps Script answers with a redirect to the result — follow it.
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const body = await res.text();
    if (!res.ok || !body.includes('"ok":true'))
      console.error(`[orders] sheet copy of ${order.number} rejected: ${res.status} ${body.slice(0, 200)}`);
  } catch (err) {
    console.error(`[orders] sheet copy of ${order.number} failed`, err);
  }
}

/** Every order, newest first. */
export async function listOrders(): Promise<Order[]> {
  const doc = await readJSON<OrdersDoc>(KEY);
  return [...(doc?.orders ?? [])].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** Changes one order with read-change-write safety. Returns it as saved, or null. */
export async function changeOrder(number: string, change: (o: Order) => void): Promise<Order | null> {
  let saved: Order | null = null;
  await update<OrdersDoc>(KEY, (doc) => {
    const orders = doc?.orders ?? [];
    const order = orders.find((o) => o.number === number);
    if (order) {
      change(order);
      saved = order;
    }
    return { orders };
  });
  return saved;
}

/** What the tracking page shows. Deliberately no name, phone or address. */
export type OrderStatus = {
  number: string;
  status: string;
  placedAt: string;
  items: string;
  total: string;
  delivery: string;
};

/**
 * One order's status, for the person who placed it: the number plus the
 * last four digits of the phone it was placed with.
 */
export async function lookupOrder(number: string, last4: string): Promise<OrderStatus | null> {
  const order = (await listOrders().catch(() => [])).find((o) => o.number === number);
  if (!order || !order.phone.replace(/\D/g, "").endsWith(last4)) return null;
  return {
    number,
    status: order.status ?? "New",
    placedAt: order.placedAt,
    items: order.items,
    total: order.total,
    delivery: order.delivery,
  };
}
