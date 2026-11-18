import type { LineAttributes } from "./types";

/**
 * Nothing the browser sends is trusted. The product page only lets you type
 * twelve letters and two digits, but a request (or a cart cookie) doesn't
 * have to come from the product page — so the same rules run on the server.
 */
export function cleanAttributes(a: Partial<LineAttributes> | undefined): LineAttributes {
  const name = String(a?.name ?? "")
    .toUpperCase()
    .replace(/[^A-Z .'-]/g, "")
    .trim()
    .slice(0, 12);
  const digits = String(a?.number ?? "").replace(/\D/g, "").slice(0, 2);
  const number = Number(digits) > 0 ? digits : "";
  return { ...(name && { name }), ...(number && { number }) };
}
