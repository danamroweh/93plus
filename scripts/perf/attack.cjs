// Attempts the attacks the fixes are meant to stop, against a running build.
// usage: node attack.cjs http://localhost:3094
const { chromium } = require("/Users/hadim/moodboard/node_modules/playwright");
const fs = require("node:fs");
const base = process.argv[2];
const ORDERS = "/Users/hadim/moodboard/93plus/orders.jsonl";
const rows = () => (fs.existsSync(ORDERS) ? fs.readFileSync(ORDERS, "utf8").split("\n").filter(Boolean).length : 0);

(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("93plus:preloaded", String(Date.now())));
  const page = await ctx.newPage();
  const captured = [];
  page.on("request", (r) => {
    const id = r.headers()["next-action"];
    if (id && r.method() === "POST") captured.push({ id, url: r.url(), body: r.postData() || "" });
  });

  // ── 1. one real order through the UI, to learn the action ids ──────
  await page.goto(base + "/product/real-madrid-mug", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: "Checkout →" }).click();
  await page.getByLabel("Phone").fill("71123456");
  await page.getByLabel("Name").fill("LOADTEST");
  await page.locator("select").selectOption("Beirut");
  await page.locator("textarea").fill("Test building, test street");
  await page.getByLabel("Notes (optional)").fill("production-readiness attack test, delete me");
  const before = rows();
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.getByText("Order confirmed").waitFor({ timeout: 15000 });
  const add = captured.find((c) => c.body.startsWith('["real-madrid-mug'));
  const order = captured.find((c) => c.body.includes("idempotencyKey"));
  console.log(`UI order placed · rows ${before} → ${rows()} · add action ${add ? "captured" : "MISSING"} · order action ${order ? "captured" : "MISSING"}`);
  if (!add || !order) { await b.close(); process.exit(1); }

  const call = (a, body) =>
    page.evaluate(async ({ url, id, body }) => {
      const r = await fetch(url, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body });
      return r.text();
    }, { url: a.url, id: a.id, body });
  const orderBody = (key, name = "LOADTEST") => {
    const args = JSON.parse(order.body);
    args[0] = { ...args[0], name, notes: "production-readiness attack test, delete me", idempotencyKey: key };
    return JSON.stringify(args);
  };

  // ── 2. tampered add-to-cart: quantity 999, script tag as the name ──
  await call(add, JSON.stringify(["real-madrid-mug--default", 999, { name: "<script>alert(1)</script>", number: "999" }]));
  await call(add, JSON.stringify(["real-madrid-mug--default", -5, {}]));
  await call(add, JSON.stringify(["not-a-real-variant", 1, {}]));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Cart \(/ }).click();
  await page.waitForTimeout(600);
  const drawer = await page.getByRole("dialog", { name: "Cart" }).innerText();
  const qty = drawer.match(/Cart \((\d+)\)/)?.[1];
  console.log(`tampered add → cart holds ${qty} items (asked for 999) · "<" in cart text: ${drawer.includes("<")} · line text: ${drawer.split("\n").filter((l) => /SCRIPT|Mug/.test(l)).slice(0, 3).join(" / ")}`);

  // ── 3. double submit with the same key → one order ──────────────────
  const b3 = rows();
  const key = "dbl-" + Math.random().toString(36).slice(2, 12);
  const [r1, r2] = await Promise.all([call(order, orderBody(key)), call(order, orderBody(key))]);
  const n1 = r1.match(/"number":"(93-[\d-]+)"/)?.[1], n2 = r2.match(/"number":"(93-[\d-]+)"/)?.[1];
  console.log(`double submit, same key → rows ${b3} → ${rows()} (expect +1) · numbers ${n1} / ${n2} (expect equal)`);

  // ── 4. a burst of orders from one address → rate limit ──────────────
  const results = [];
  for (let i = 0; i < 6; i++) {
    await call(add, JSON.stringify(["real-madrid-mug--default", 1, {}]));
    const r = await call(order, orderBody("burst-" + i + "-" + Math.random().toString(36).slice(2, 10)));
    results.push(/Too many orders/.test(r) ? "LIMITED" : r.includes('"ok":true') ? "ok" : "rejected:" + (r.match(/"error":"([^"]+)"/)?.[1] ?? "?"));
  }
  console.log(`burst of 6 → ${results.join(", ")}`);

  // ── 5. clean the test rows out of orders.jsonl ──────────────────────
  if (fs.existsSync(ORDERS)) {
    const keep = fs.readFileSync(ORDERS, "utf8").split("\n").filter((l) => l && !l.includes("attack test, delete me"));
    fs.writeFileSync(ORDERS, keep.length ? keep.join("\n") + "\n" : "");
    console.log(`orders.jsonl cleaned → ${keep.length} rows`);
  }
  await b.close();
})();
