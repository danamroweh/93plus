/**
 * Catalogue → Shopify product import CSV.
 *
 *   node scripts/shopify-csv.mts     →  shopify/products.csv
 *
 * Import it in Shopify admin → Products → Import. Re-running after
 * catalogue edits and importing with "Overwrite products with matching
 * handles" keeps the store in step. Photos are uploaded in the admin —
 * CSV only takes public URLs.
 */

import { writeFileSync } from "node:fs";
import {
  CATALOGUE,
  CUSTOM,
  PRICES,
  SIZES,
  collectionsOf,
  shirtPricing,
  type CatalogueEntry,
} from "../src/lib/commerce/catalogue.ts";

const HEAD = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
  "Option3 Name", "Option3 Value", "Variant SKU", "Variant Grams",
  "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price",
  "Variant Requires Shipping", "Variant Taxable", "Status",
];

const dollars = (cents: number) => (cents / 100).toFixed(2);
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

type Row = Record<string, string>;

function tags(entry: CatalogueEntry) {
  const t = collectionsOf(entry);
  if (entry.kind === "shirt")
    for (const p of entry.presets ?? (entry.preset ? [entry.preset] : []))
      t.push(`preset:${p.name}:${p.number}`);
  return t.join(", ");
}

function rows(entry: CatalogueEntry): Row[] {
  const first: Row = {
    Handle: entry.handle,
    Title: entry.title,
    "Body (HTML)": `<p>${entry.description}</p>`,
    Vendor: "93+",
    Type:
      entry.kind === "shirt"
        ? ({ Retro: "Retro shirt", "Long sleeve": "Long sleeve", Tracksuit: "Tracksuit" } as Record<string, string>)[entry.kit] ?? "Shirt"
        : entry.item,
    Tags: tags(entry),
    Published: "TRUE",
    Status: "active",
  };
  const variant = (r: Row, sku: string, cents: number): Row => ({
    ...r,
    Handle: entry.handle,
    "Variant SKU": sku,
    "Variant Grams": entry.kind === "shirt" ? "250" : "300",
    "Variant Inventory Policy": "deny",
    "Variant Fulfillment Service": "manual",
    "Variant Price": dollars(cents),
    "Variant Requires Shipping": "TRUE",
    "Variant Taxable": "TRUE",
  });

  if (entry.kind === "printable")
    return [
      variant(
        { ...first, "Option1 Name": "Title", "Option1 Value": "Default Title" },
        entry.handle.toUpperCase(),
        entry.cents ?? PRICES[entry.item],
      ),
    ];

  const out: Row[] = [];
  const pricing = shirtPricing(entry);
  // Retros, long sleeves and tracksuits have no Version option.
  const opts = (version: string | undefined, size: string, custom: string) =>
    version
      ? [["Version", version], ["Size", size], ["Customisation", custom]]
      : [["Size", size], ["Customisation", custom]];
  for (const version of pricing.versions.length ? pricing.versions : [undefined])
    for (const size of SIZES)
      for (const custom of CUSTOM) {
        const cents = pricing.base(version) + (custom === "Blank" ? 0 : pricing.printing);
        const sku = [entry.handle, version, size, custom === "Blank" ? "B" : "NN"]
          .filter(Boolean)
          .join("-")
          .toUpperCase();
        const row: Row = { ...(out.length ? {} : first) };
        opts(version, size, custom).forEach(([name, value], i) => {
          row[`Option${i + 1} Name`] = out.length ? "" : name;
          row[`Option${i + 1} Value`] = value;
        });
        out.push(variant(row, sku, cents));
      }
  return out;
}

const all = CATALOGUE.flatMap(rows);
const csv = [HEAD, ...all.map((r) => HEAD.map((h) => r[h] ?? ""))]
  .map((line) => line.map(cell).join(","))
  .join("\n");

writeFileSync(new URL("../shopify/products.csv", import.meta.url), csv + "\n");
console.log(`shopify/products.csv — ${CATALOGUE.length} products, ${all.length} variants`);
