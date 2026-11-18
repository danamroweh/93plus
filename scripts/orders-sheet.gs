/**
 * 93+ · Orders sheet
 *
 * Paste into the sheet's Extensions → Apps Script, set SECRET to the same
 * value as ORDERS_WEBHOOK_SECRET, and deploy as a web app (see ORDERS.md).
 * Every order placed on the site becomes one row on the "Orders" tab.
 */

const SECRET = "change-me";
const TAB = "Orders";

const COLUMNS = [
  ["Placed", (o) => new Date(o.placedAt)],
  ["Order", (o) => o.number],
  ["Status", () => "New"],
  ["Name", (o) => o.name],
  ["Phone", (o) => "'" + o.phone], // keep the leading 0 / +961
  ["Area", (o) => o.area],
  ["Address", (o) => o.address],
  ["Items", (o) => o.items],
  ["Subtotal", (o) => o.subtotal],
  ["Delivery", (o) => o.delivery],
  ["Total", (o) => o.total],
  ["Payment", (o) => o.payment],
  ["Notes", (o) => o.notes],
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ ok: false, error: "forbidden" });

    const sheet = tab();
    sheet.appendRow(COLUMNS.map(([, get]) => get(body.order)));
    return json({ ok: true, number: body.order.number });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Units sold per product, for the homepage's Best sellers row. The site asks
 * for GET ?action=counts&secret=… at most every 15 minutes. Cancelled orders
 * don't count. Product names and numbers only — no customer data leaves.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.secret !== SECRET) return json({ ok: false, error: "forbidden" });
  if (p.action === "order") return json(lookup(p.number, p.phone));
  if (p.action !== "counts") return json({ ok: false, error: "unknown action" });

  const counts = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
  if (sheet && sheet.getLastRow() > 1) {
    const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const status = head.indexOf("Status");
    const items = head.indexOf("Items");
    const rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, head.length)
      .getValues();
    rows.forEach((row) => {
      if (row[status] === "Cancelled") return;
      // One line per item: "2× Real Madrid Home 26/27 — Fan · M · Blank"
      String(row[items])
        .split("\n")
        .forEach((line) => {
          const m = line.match(/^(\d+)× (.+?) — /);
          if (m) counts[m[2]] = (counts[m[2]] || 0) + Number(m[1]);
        });
    });
  }
  return json({ ok: true, counts });
}

/**
 * One order's status for the site's tracking page: the order number plus the
 * last four digits of the phone it was placed with. Name, phone and address
 * never leave the sheet.
 */
function lookup(number, last4) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
  if (!sheet || sheet.getLastRow() < 2 || !number || !last4) return { ok: false, error: "not found" };
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = (name) => head.indexOf(name);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, head.length).getValues();
  for (const row of rows) {
    if (String(row[col("Order")]) !== String(number)) continue;
    if (!String(row[col("Phone")]).replace(/\D/g, "").endsWith(String(last4))) continue;
    const placed = row[col("Placed")];
    return {
      ok: true,
      order: {
        number: String(number),
        status: String(row[col("Status")] || "New"),
        placedAt: placed instanceof Date ? placed.toISOString() : String(placed),
        items: String(row[col("Items")]),
        total: String(row[col("Total")]),
        delivery: String(row[col("Delivery")]),
      },
    };
  }
  return { ok: false, error: "not found" };
}

function tab() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(TAB);
  if (!sheet) {
    sheet = book.insertSheet(TAB);
    sheet.appendRow(COLUMNS.map(([name]) => name));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
    // Status as a dropdown so the sheet doubles as the order board.
    sheet
      .getRange("C2:C")
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(["New", "Confirmed", "Paid", "Out for delivery", "Delivered", "Cancelled"])
          .build(),
      );
  }
  return sheet;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
