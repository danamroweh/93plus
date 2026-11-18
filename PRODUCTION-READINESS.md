# Production readiness — 93+

Audited Oct 22 2026 with the playbook in `moodboard/production-readiness/PLAYBOOK.md`.
Profile: a public football shirt shop; spiky on drops; money is cash / Whish / OMT
through an on-site form (Shopify later); no accounts; media- and motion-heavy.
Everything the DAY 1 tier asks for is done. Below is what's left, by tier, and
what was deliberately skipped.

## Done (DAY 1)
- Security headers on every page: CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy,
  Permissions-Policy (`next.config.ts`).
- Cart and order requests are validated on the server: quantities 1–20, names 12 letters,
  numbers 2 digits, unknown variants dropped (`src/lib/commerce/actions.ts`).
- Rate limits: 60 cart changes a minute per address; 5 orders in 10 minutes per address and
  120 a minute overall (`src/lib/rate-limit.ts`). In memory, so one machine only.
- Idempotency key on every order: a double tap or a retried request places one order.
- In-memory carts are capped (5 000 carts, 30 lines, 20 per line) so a script can't fill the
  machine (`src/lib/commerce/mock.ts`).
- Home page is static with a 15-minute refresh (`/season/<id>` previews the other seasons);
  product and collection pages were already static.
- Product-page HTML no longer cached for a day by mistake; photos cached a year (URLs carry
  the file's version).
- Fonts all self-hosted and preloaded (Anton no longer fetched from Google at build time).
- Lenis only loads on mouse devices; ScrollTrigger replaced by an IntersectionObserver;
  preloader, card reveal and confirmation respect `prefers-reduced-motion`.
- Hover frames reach mouse devices only (`<picture>` media query), eager for the first row.
- Photos in three sizes (432/648/864) with srcset; the search index fetched on idle instead of
  riding in every page; cards hand the quick-add button 5 variants instead of 22. Home HTML
  43 → 29 KB gzipped, a collection page 47 → 24 KB; a phone's home load 964 → 624 KB.
- Optimistic add to cart, card→page morph, remembered size, sticky add bar on phones,
  prefetch on touch, per-product share images, order tracking (`/order`), typo-tolerant and
  Arabic search, cart skeleton — all Oct 22.

- Oct 23: the preloader plays on the home page only; shared shirt and collection links open
  straight onto the page (on slow 4G: shirt on screen at first paint, page interactive at
  ~3.9 s instead of ~6 s behind the preloader). GSAP left the first load: card reveal,
  cursor and cart sparkle run on the browser's own animation API with GSAP's exact curves
  (within 1% frame for frame, `scripts/perf/motion.cjs`); GSAP is fetched only when the
  preloader or the order confirmation plays. JS on a phone 197 → 172 KB. Trade-off: a first
  visit to the home page on slow 4G takes ~0.2 s longer to start the preloader.

- Nov 18: shop editor at `/admin` (one password, signed cookie, 10 tries / 15 min). Carts
  moved from server memory into the cart cookie, so a restart or a hosted server with many
  machines never empties a cart. Orders and editor data live in the store (`.data/` or
  Netlify Blobs), so nothing writes to the server's disk on a host. Orders check stock
  before they're placed and take it after. Photo manifest built with the site so
  re-rendered pages keep their photos on Netlify.

## Open — LAUNCH (before the public link goes out)
1. **Host behind a CDN with https.** Vercel is the least work for Next; put Cloudflare in
   front for the WAF and (later) a waiting room. HSTS and the `Secure` cookie flag only do
   anything over https.
2. **Strict CSP.** The current policy still allows inline scripts. The nonce-based version
   needs a middleware that stamps each request; about half a day.
3. **Error tracking + real-user vitals.** Sentry (browser + server) and Vercel Analytics or
   Cloudflare Web Analytics, read at p75, never the average.
4. **Uptime check** on `/` and one product page (Better Stack, UptimeRobot).
5. **Turnstile on the checkout form** once it's public: the rate limit stops floods, a bot
   placing 5 fake orders every 10 minutes from rotating addresses still gets through.
6. **Order sheet resilience.** The 10 s timeout is in; a retry and an alert aren't. Every
   order is also kept in the store now, so a sheet failure loses nothing.
8. **Dependency hygiene.** Commit a lockfile with the repo, `npm audit`, Dependabot.
9. **Sitemap + robots** for the static pages.

## Open — SCALE (for a drop)
- Waiting room (Cloudflare) in front of product pages and checkout.
- Rate limits and the idempotency map move to a shared store (Redis) if there is ever a
  second machine. Shopify's checkout carries the money path under load.

## Skipped, and why
- Accounts / private data / uploads / realtime / AI: the shop has none of them.
- Database items: there is no database until Shopify; orders are rows in a Google Sheet.
- Offline / service worker: a shop that's mostly first visits gains little; revisit if a
  PWA install prompt is wanted.
