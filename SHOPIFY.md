# Going live on Shopify

The site runs on the demo catalogue until two env vars are set. Then it runs
on Shopify — same design, real checkout. Nothing in the UI changes.

## 1. Store

Create a Shopify store (Basic plan, free trial is fine).

## 2. Products — one import

```bash
npm run shopify:csv
```

Shopify admin → **Products → Import** → `shopify/products.csv`.
That's all 28 products and 332 variants, with prices, options and tags.
Re-run + re-import (tick *Overwrite products with matching handles*) after
editing `src/lib/commerce/catalogue.ts`.

Photos: upload in the admin on each product. First photo = grid image,
second = the hover/back.

## 3. Collections — tag rules

Products → **Collections → Create collection** → type *Smart* → condition
**Product tag is equal to** the handle below. Use the title exactly as
written so Shopify generates the matching handle.

| Title            | Tag                |
| ---------------- | ------------------ |
| Real Madrid      | `real-madrid`      |
| Barcelona        | `barcelona`        |
| Liverpool        | `liverpool`        |
| Juventus         | `juventus`         |
| Bayern Munich    | `bayern-munich`    |
| AC Milan         | `ac-milan`         |
| Arsenal          | `arsenal`          |
| Inter            | `inter`            |
| Champions League | `champions-league` |
| Home Kits        | `home-kits`        |
| Away Kits        | `away-kits`        |
| Third Kits       | `third-kits`       |
| Retro            | `retro`            |
| Accessories      | `accessories`      |

Titled as above, Shopify derives each collection's handle to match its tag.
Leagues aren't collections — they're defined in `catalogue.ts` (`LEAGUES`)
over these team handles.

Anything in the categories list in `catalogue.ts` shows in the Categories
rail; every other collection is treated as a team. The homepage Best sellers
row is ranked from orders (see ORDERS.md), so no Best Sellers collection is
needed.

## 4. Connect the site

1. Install the **Headless** sales channel (Shopify App Store, free).
2. Create a storefront → copy the **public access token**.
3. Make products and collections available to the Headless channel
   (Products → select all → *Include in sales channels*).
4. In this folder, create `.env.local`:

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=<public access token>
```

5. Restart the dev server. Checkout now opens Shopify's hosted checkout.

## 5. Payments (Lebanon)

Shopify Payments isn't available in Lebanon. Settings → Payments →
**Manual payment methods**: add *Cash on delivery* and a custom one for
Whish / OMT transfer. Card gateways can come later.

## How the conventions map

- Name + number printing is the *Customisation* option (price difference
  lives on the variant); the name and number ride on the cart line as
  attributes **Name** and **Number** — visible on every order.
- A `preset:RONALDO:7` tag pre-fills the personalisation on that product.
- A `featured` tag is read but unused until wide product shots exist.
