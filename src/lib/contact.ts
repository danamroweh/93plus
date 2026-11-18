/**
 * 93+ · Contact
 *
 * One place for the handles, the number and the delivery rules — the
 * footer, the info pages and checkout all read from here.
 */

import { FREE_SHIPPING_CENTS } from "./commerce/types";

export const INSTAGRAM_URL = "https://www.instagram.com/ninety_three_plus/";
/** International format, digits only — what wa.me wants. */
export const WHATSAPP_NUMBER = "96171312076";
export const WHATSAPP_DISPLAY = "+961 71 312 076";

export const DELIVERY = { beirut: 400, lebanon: 500 } as const;

/**
 * The delivery promise, everywhere it's stated: usually 4–5 days, never more
 * than a week — printing included. Calendar days, because that's how people
 * count when they're waiting for a parcel.
 */
export const DELIVERY_DAYS = { from: 4, to: 5, latest: 7 } as const;

/** "Wed 15 Oct" — Beirut time, whatever server or phone does the maths. */
const day = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Beirut",
  });

/** When an order placed at `placed` arrives: the usual window and the latest. */
export function deliveryWindow(placed: Date) {
  const plus = (n: number) => new Date(placed.getTime() + n * 86_400_000);
  return {
    from: day(plus(DELIVERY_DAYS.from)),
    to: day(plus(DELIVERY_DAYS.to)),
    latest: day(plus(DELIVERY_DAYS.latest)),
  };
}

export const whatsappLink = (text?: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/**
 * Delivery areas, in the order people think of the country. Beirut is the
 * cheaper run; everywhere else is one flat price.
 */
export const AREAS = [
  "Beirut",
  "Metn",
  "Baabda",
  "Keserwan",
  "Jbeil",
  "Aley",
  "Chouf",
  "Tripoli & North",
  "Akkar",
  "Zahle & Bekaa",
  "Baalbek-Hermel",
  "Saida",
  "Tyre",
  "Nabatieh",
] as const;

export type Area = (typeof AREAS)[number];

export function deliveryFor(area: string, subtotalCents: number) {
  if (subtotalCents >= FREE_SHIPPING_CENTS) return 0;
  return area === "Beirut" ? DELIVERY.beirut : DELIVERY.lebanon;
}

export const PAYMENT_METHODS = [
  {
    id: "cash",
    label: "Cash on delivery",
    note: "Pay the courier at the door.",
  },
  {
    id: "whish",
    label: "Whish",
    note: "You'll get our Whish number and your order code on the next screen. We ship once it lands and confirm on WhatsApp.",
  },
  {
    id: "omt",
    label: "OMT",
    note: "You'll get our OMT details and your order code on the next screen. We ship once it lands and confirm on WhatsApp.",
  },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];

/** Where Whish / OMT transfers go. Assumed to be the shop number. */
export const TRANSFER_NUMBER_DISPLAY = WHATSAPP_DISPLAY;
