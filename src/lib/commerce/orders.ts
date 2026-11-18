import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatPrice } from "@/lib/utils";
import { readJSON, writeJSON } from "@/lib/store";
import type { Cart } from "./types";

/**
 * 93+ · Orders
 *
 * Until Shopify is live, an order is one row in a Google Sheet. The sheet
 * runs a tiny Apps Script web app (scripts/orders-sheet.gs, set up in
 * ORDERS.md) and the site POSTs each order to it.
 *
 * Every order is also kept in the shop's own store (`orders/<number>.json`,
 * src/lib/store.ts) — the only copy when no ORDERS_WEBHOOK_URL is set, and a
 * backup when one is. (Orders placed before the store existed are in
 * `orders.jsonl`, which the tracking page still reads.)
 */

export type OrderDetails = {
  name: string;
  phone: string;
  area: string;
  address: string;
  payment: string;
  notes: string;
};

export type Order = OrderDetails & {
  number: string;
  placedAt: string;
  items: string;
  subtotal: string;
  delivery: string;
  total: string;
  totalCents: number;
};

/** "93-1009-4817": prefix, month+day, four random digits. Readable on the phone. */
function orderNumber(date: Date) {
  const md =
    `${date.getMonth() + 1}`.padStart(2, "0") +
    `${date.getDate()}`.padStart(2, "0");
  const tail = Math.floor(1000 + Math.random() * 9000);
  return `93-${md}-${tail}`;
}

/** One line per item — readable in a single spreadsheet cell. */
function itemsText(cart: Cart) {
  return cart.lines
    .map((line) => {
      const opts =
        Object.values(line.variant.options).join(" · ") || "One size";
      const print = [line.attributes.name, line.attributes.number]
        .filter(Boolean)
        .join(" ");
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
  };
}

export async function recordOrder(order: Order) {
  const url = process.env.ORDERS_WEBHOOK_URL;
  const kept = writeJSON(`orders/${order.number}.json`, order);

  if (!url) {
    await kept;
    console.warn(`[orders] ORDERS_WEBHOOK_URL not set — ${order.number} kept in the store only`);
    return;
  }

  // The sheet is the one that has to work; the store copy is a backup.
  kept.catch((err) => console.error(`[orders] store copy of ${order.number} failed`, err));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.ORDERS_WEBHOOK_SECRET ?? "",
      order,
    }),
    // Apps Script answers with a redirect to the result — follow it.
    redirect: "follow",
    cache: "no-store",
    // A slow sheet must not hold "Place order" forever.
    signal: AbortSignal.timeout(10_000),
  });

  const body = await res.text();
  if (!res.ok || !body.includes('"ok":true')) {
    throw new Error(
      `Order sheet rejected ${order.number}: ${res.status} ${body.slice(0, 200)}`,
    );
  }
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
 * last four digits of the phone it was placed with. From the sheet when
 * it's connected (`?action=order`, scripts/orders-sheet.gs), otherwise from
 * orders.jsonl, where every order is simply "New".
 */
export async function lookupOrder(
  number: string,
  last4: string,
): Promise<OrderStatus | null> {
  const url = process.env.ORDERS_WEBHOOK_URL;

  if (!url) {
    const kept = await readJSON<Order>(`orders/${number}.json`).catch(() => null);
    if (kept && kept.phone.replace(/\D/g, "").endsWith(last4))
      return {
        number,
        status: "New",
        placedAt: kept.placedAt,
        items: kept.items,
        total: kept.total,
        delivery: kept.delivery,
      };
    const file = path.join(process.cwd(), "orders.jsonl");
    if (!existsSync(file)) return null;
    for (const line of (await readFile(file, "utf8")).split("\n")) {
      if (!line) continue;
      try {
        const o = JSON.parse(line) as Order;
        if (o.number === number && o.phone.replace(/\D/g, "").endsWith(last4))
          return {
            number,
            status: "New",
            placedAt: o.placedAt,
            items: o.items,
            total: o.total,
            delivery: o.delivery,
          };
      } catch {
        /* a bad line is skipped */
      }
    }
    return null;
  }

  const u = new URL(url);
  u.searchParams.set("action", "order");
  u.searchParams.set("number", number);
  u.searchParams.set("phone", last4);
  u.searchParams.set("secret", process.env.ORDERS_WEBHOOK_SECRET ?? "");
  try {
    const res = await fetch(u, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { ok?: boolean; order?: OrderStatus };
    return body.ok && body.order ? body.order : null;
  } catch {
    return null;
  }
}
