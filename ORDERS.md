> **Nov 18 2026:** orders now live in the shop editor (`/admin` → Orders):
> statuses, Call / WhatsApp, cancel with stock returned. The customer's
> tracking page reads the editor's status. The Google Sheet below is optional
> — set it up only if you also want each new order copied into a spreadsheet.

# Orders → Google Sheet

Checkout on the site is one form in the cart drawer. Each order becomes one
row in a Google Sheet: date, order number, status, name, phone, area,
address, items, totals, payment, notes.

Until the sheet is connected, orders save to `orders.jsonl` in the project
root, so the demo still works end to end.

## Setup (about 5 minutes, once)

1. Create a new Google Sheet, for example "93+ Orders".
2. **Extensions → Apps Script.** Delete what's there and paste in all of
   `scripts/orders-sheet.gs`.
3. Change `SECRET = "change-me"` to a long random string. Save.
4. **Deploy → New deployment → Select type: Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click Deploy, then authorise with your Google account. It will warn that
   the app is unverified: click *Advanced → Go to project*.
5. Copy the **Web app URL**. It ends in `/exec`.
6. Add both values to `.env.local` in the project root (or to Vercel's
   environment variables at launch):

   ```
   ORDERS_WEBHOOK_URL=https://script.google.com/macros/s/…/exec
   ORDERS_WEBHOOK_SECRET=the same string as in step 3
   ```

7. Rebuild and restart the site. The first order creates the "Orders" tab
   with headers and a Status dropdown: New → Confirmed → Paid → Out for
   delivery → Delivered.

If you edit the script later: **Deploy → Manage deployments → edit → Version:
New version**. The URL stays the same.

## Best sellers come from this sheet

The homepage's Best sellers row ranks shirts by units ordered, read from the
same script (`doGet`, `?action=counts`). Cancelled rows don't count. Until a
shirt has orders, the row shows the newest shirt from each team.

If your sheet was set up before October 11 2026, paste the updated
`scripts/orders-sheet.gs` and redeploy as a **new version** — the old one
has no `doGet`, and the row stays on the newest-per-team default.

## Order tracking

The site's **Track an order** page (`/order`, linked from every receipt and the
footer) asks the sheet for one order's status: `GET ?action=order&number=…&phone=…`,
where `phone` is the last four digits the customer typed. The script answers with
the Status column, the items and the total — never the name, phone or address.
Moving the Status dropdown on a row is all it takes to update what the customer
sees. If your sheet was deployed before October 22 2026, paste the updated
`scripts/orders-sheet.gs` and redeploy as a **new version**.

## Once Shopify is live

The cart's Checkout button switches to Shopify's own checkout automatically,
and orders go to the Shopify admin instead of the sheet.
