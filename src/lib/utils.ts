import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 9500 → "$95.00" */
export function formatPrice(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    trailingZeroDisplay: "stripIfInteger",
  }).format(amount / 100);
}

/**
 * For matching: lower case, accents off ("Barça" → "barca"), punctuation to
 * spaces. Arabic is kept and folded the way people type it: no harakat, one
 * alef, ة as ه, ى as ي — so "ريال" finds "ريال مدريد" however it was written.
 */
export function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064b-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/[^a-z0-9/\u0621-\u064a]+/g, " ")
    .trim();
}
