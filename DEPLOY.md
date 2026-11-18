# Putting 93+ online

The shop and its editor (`/admin`) are built for **Netlify**: the free plan
allows a shop, it runs Next.js as is, and the editor stores everything in
**Netlify Blobs** with no setup (no database account, no keys).

## What lives where

| | On this Mac | On Netlify |
|---|---|---|
| Product changes from the editor | `.data/catalogue.json` | Netlify Blobs, store `93plus` |
| Photos uploaded in the editor | `.data/media/` | Netlify Blobs |
| Orders (the editor's Orders room) | `.data/orders.json` | Netlify Blobs (+ a copy in the Google Sheet if connected) |
| Studio photos (`public/product/`) | in the project | deployed with the site |

The two are separate. Edits made in the editor on this Mac stay on this Mac.
Once the site is live, Dana edits on the live site: `https://<domain>/admin`.

## 1. Put the project in its own GitHub repo (private)

```bash
cd ~/moodboard/93plus && git init && git add . && git commit -m "93+ shop"
```

```bash
gh repo create 93plus --private --source . --push
```

`shoots/` (325 MB of source takes) and the contact sheets are git-ignored; the
shop only needs `public/product/`.

## 2. Create the Netlify site

Netlify → **Add new site → Import an existing project** → GitHub → `93plus`.
The build settings come from `netlify.toml`. Before the first deploy, open
**Site configuration → Environment variables** and add:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | the editor password — a new, long one (not the one in `.env.local`) |
| `ADMIN_SECRET` | any long random text (`openssl rand -base64 24`) |
| `SITE_URL` | `https://<your domain>` (share previews use it) |
| `ORDERS_WEBHOOK_URL` | the Google Sheet web app URL (ORDERS.md) |
| `ORDERS_WEBHOOK_SECRET` | the secret from ORDERS.md |

Without the sheet, orders are still kept and trackable. They just aren't in a
spreadsheet. Then **Deploy**.

## 3. The domain

Netlify → **Domain management → Add a domain**. Either buy it there (no DNS to
touch), or buy it elsewhere and point it at Netlify:

- `@` (the bare domain): **A** record → `75.2.60.5`
- `www`: **CNAME** → `<site-name>.netlify.app`

HTTPS turns on by itself once the DNS is seen (minutes to an hour). Then set
`SITE_URL` to the final address and redeploy once.

## 4. Check it (2 minutes)

1. `https://<domain>/admin` → sign in.
2. Open any shirt, + $1 on the Fan price → **Save** → open the shirt in the shop:
   the new price is there. Put it back.
3. **Add a product** with a phone photo → it appears in its team and on its page.
   Delete it (it can be brought back from ⋯ → Deleted products).
4. Place a test order with cash. It shows in the sheet, and `/order` finds it.

## Good to know

- Everything Dana changes is live on the next page visit. There's no publish
  step and no rebuild.
- Redeploying (a code change) never touches her edits. They live in Blobs, not
  in the code.
- Rate limits and the double-order guard count per server instance. On Netlify
  that's per function instance, which is fine for this size of shop. A drop with
  heavy traffic is the time to revisit it (PRODUCTION-READINESS.md, SCALE).
- `npm run build` writes `src/lib/commerce/photo-manifest.json` from
  `public/product/` first, because Netlify's servers can't see `public/`. A new
  studio shoot needs a deploy. A photo uploaded in the editor doesn't.

## Live setup (Nov 18 2026)

- Repo: github.com/danamroweh/93plus (public: Netlify's free plan only builds
  other people's commits on public repos). hadi-music can push.
- Netlify: Dana's account, team "93 Plus", project `93plus` →
  https://93plus.netlify.app. Every push to `main` deploys in about a minute.
- `ADMIN_PASSWORD` is set in Netlify (Production). New Netlify projects start
  **private** (only Dana's Netlify login can open them) until "Make public".
- Netlify Blobs is spoken to directly from `src/lib/store.ts`: the
  `@netlify/blobs` v11 client hung on every call inside the Next.js server.
