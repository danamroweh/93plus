// Drives the shop editor end to end against a running server and checks the
// shop follows: price change, counted stock + an order taking it, a new team,
// a new product with an uploaded photo, hide, delete, undo, bring back.
// usage: node admin.cjs <base> <outdir>
// Reads ADMIN_PASSWORD from .env.local. Leaves its test product deleted and
// the edited product as it was.
const { chromium, devices } = require("/Users/hadim/moodboard/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");

const base = process.argv[2] || "http://localhost:3093";
const outDir = process.argv[3] || ".";
const env = fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8");
const password = env.match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
const seen = () => localStorage.setItem("93plus:preloaded", String(Date.now()));
const RM = "Real Madrid Home 26/27";

(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const out = [];
  const log = (s) => {
    out.push(s);
    console.log(s);
  };
  const shot = (p, name) => p.screenshot({ path: `${outDir}/${name}.png` });
  const errs = [];

  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  await ctx.addInitScript(seen);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));

  // ── sign in ──
  await p.goto(base + "/admin", { waitUntil: "networkidle" });
  await shot(p, "01-sign-in");
  await p.getByRole("textbox", { name: "Password" }).fill("wrong-password");
  await p.getByRole("button", { name: "Open" }).click();
  log(`wrong password → ${await p.getByText("That's not the password.").innerText()}`);
  await p.getByRole("textbox", { name: "Password" }).fill(password);
  await p.getByRole("button", { name: "Open" }).click();
  await p.getByRole("heading", { name: "Products" }).waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  log(`signed in → ${await p.locator("main p").first().innerText()}`);
  await shot(p, "02-products-phone");

  // ── search ──
  await p.getByPlaceholder(/Find a product/).fill("barca");
  await p.waitForTimeout(200);
  log(`search "barca" → ${await p.locator("main ul li").count()} products`);
  await p.getByPlaceholder(/Find a product/).fill("");

  // ── change a price ──
  const card = p.getByRole("button", { name: new RegExp(`^${RM.replace("/", "\\/")},`) }).first();
  await card.click();
  await p.getByRole("dialog", { name: RM }).waitFor();
  await p.waitForTimeout(400);
  await shot(p, "03-product-sheet-phone");
  await p.getByRole("button", { name: "Higher — Fan price" }).click();
  await p.getByRole("button", { name: "Save", exact: true }).click();
  log(`price +$1 → toast "${await p.getByRole("status").innerText()}"`);
  let html = await (await p.request.get(base + "/product/real-madrid-home-26-27")).text();
  log(`shop product page shows $26: ${html.includes("$26")}`);

  // ── counted stock: Fan M = 1, everything else 0 ──
  await card.click();
  await p.getByRole("dialog", { name: RM }).waitFor();
  await p.getByRole("radio", { name: "Count stock" }).click();
  await p.getByRole("textbox", { name: "Fan M", exact: true }).fill("1");
  await p.getByRole("dialog", { name: RM }).getByText("1 in stock").waitFor();
  await shot(p, "04-count-stock-phone");
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByRole("status").waitFor();
  await p.waitForTimeout(300);
  log(`card after count → "${(await card.innerText()).replace(/\n/g, " · ")}"`);

  // ── an order takes the last one ──
  const shop = await ctx.newPage();
  shop.on("pageerror", (e) => errs.push(String(e)));
  await shop.goto(base + "/product/real-madrid-home-26-27", { waitUntil: "networkidle" });
  const struck = await shop.getByRole("button", { name: "L", exact: true }).evaluate((el) => el.disabled || el.getAttribute("aria-disabled"));
  log(`shop: size L (0 left) disabled → ${struck}`);
  await shop.getByRole("button", { name: "Fan", exact: true }).click().catch(() => {});
  await shop.getByRole("button", { name: "M", exact: true }).click();
  await shop.getByRole("button", { name: "Add to cart" }).first().click();
  const cart = shop.getByRole("dialog", { name: "Cart" });
  await cart.getByText(RM).first().waitFor({ timeout: 10000 });
  await cart.getByText("Checkout →").click();
  await shop.getByPlaceholder("71 123 456").fill("71 000 111");
  await shop.getByLabel("Name").fill("Editor Test");
  await shop.locator("select").first().selectOption({ index: 1 });
  await shop.getByPlaceholder("Building, street, nearest landmark").fill("Test building, test street");
  await shop.locator('input[name="payment"]').first().check({ force: true });
  await shop.getByRole("button", { name: /Place order/ }).click();
  await shop.getByText(/93-\d{4}-\d{4}/).first().waitFor({ timeout: 20000 });
  const number = (await shop.getByText(/93-\d{4}-\d{4}/).first().innerText()).match(/93-\d{4}-\d{4}/)[0];
  const book = path.join(__dirname, "../../.data/orders.json");
  log(`order placed → ${number}; in the order book: ${fs.existsSync(book) && fs.readFileSync(book, "utf8").includes(number)}`);
  await shop.goto(base + "/product/real-madrid-home-26-27", { waitUntil: "networkidle" });
  html = await shop.content();
  log(`shop after the order says Sold out: ${/Sold out/.test(html)}`);
  await shop.close();

  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("heading", { name: "Products" }).waitFor();
  log(`editor after the order → "${(await card.innerText()).replace(/\n/g, " · ")}"`);
  await p.getByRole("button", { name: /^Sold out \d/ }).click();
  log(`"Sold out" filter → ${await p.locator("main ul li").count()} product(s)`);
  await p.getByRole("button", { name: /^All \d/ }).click();

  // ── the order in the Orders room: confirm, track, cancel → stock back ──
  const ordersTab = p.getByRole("navigation", { name: "Rooms" }).getByRole("button", { name: /Orders/ });
  log(`orders tab says → "${(await ordersTab.innerText()).replace(/\n/g, " ")}"`);
  await ordersTab.click();
  const row = p.getByRole("button", { name: new RegExp(`^Order ${number}`) });
  await row.waitFor();
  await shot(p, "10-orders-phone");
  await row.click();
  await p.getByRole("dialog", { name: `Order ${number}` }).waitFor();
  await shot(p, "11-order-sheet-phone");
  await p.getByRole("button", { name: "Mark as confirmed" }).click();
  log(`confirm → toast "${await p.getByRole("status").innerText()}"`);
  const track = await ctx.newPage();
  await track.goto(base + "/order?n=" + number, { waitUntil: "load" });
  await track.getByPlaceholder("3456").fill("0111");
  await track.getByRole("button", { name: "Find my order" }).click();
  await track.waitForTimeout(2000);
  const tracked = await track.locator("main").innerText();
  log(`tracking page shows Confirmed as current: ${/CONFIRMED/i.test(tracked)} (order found: ${tracked.includes(number)})`);
  await track.close();
  await p.getByRole("button", { name: "Cancel order" }).click();
  await p.getByRole("alertdialog").getByRole("button", { name: "Cancel order" }).click();
  await p.getByRole("status").getByText("is cancelled").waitFor();
  log(`cancelled → sheet says "${(await p.getByRole("dialog", { name: `Order ${number}` }).getByText(/Cancelled/).first().innerText())}"`);
  await p.keyboard.press("Escape");
  await p.getByRole("navigation", { name: "Rooms" }).getByRole("button", { name: /Products/ }).click();
  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("heading", { name: "Products" }).waitFor();
  log(`after cancel the card says → "${(await card.innerText()).replace(/\n/g, " · ")}"`);

  // put Real Madrid back as it was: always available, $25
  await card.click();
  await p.getByRole("radio", { name: "Always available" }).click();
  await p.getByRole("button", { name: "Lower — Fan price" }).click();
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByRole("status").getByText("Saved. The shop shows it now.").waitFor();
  html = await (await p.request.get(base + "/product/real-madrid-home-26-27")).text();
  log(`Real Madrid restored: $25 ${html.includes("$25")}, sold out ${/Sold out/.test(html)}`);

  // ── add a product: new team, photo upload ──
  const photo = path.join(outDir, "upload-test.jpg");
  await require("/Users/hadim/moodboard/93plus/node_modules/sharp")(
    path.join(__dirname, "../../public/product/ac-milan-2006-07-home/01-front.webp"),
  )
    .resize(1200, 1600)
    .jpeg()
    .toFile(photo);
  await p.getByRole("button", { name: "Add a product" }).last().click();
  const sheet = p.getByRole("dialog", { name: "New product" });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Retro", exact: true }).first().click();
  await sheet.locator("select").first().selectOption("__new");
  await p.getByPlaceholder("Team name — e.g. Napoli").fill("Napoli Test");
  await p.getByRole("alertdialog").locator("select").selectOption("serie-a");
  await p.getByRole("button", { name: "Add team" }).click();
  await p.getByRole("alertdialog").waitFor({ state: "detached" });
  log(`new team → name filled "${await sheet.locator('input[placeholder^="e.g."]').inputValue()}"`);
  await sheet.locator('input[type="file"]').setInputFiles(photo);
  await sheet.getByText("Uploading…").waitFor({ state: "detached", timeout: 30000 });
  await p.waitForTimeout(300);
  await shot(p, "05-new-product-phone");
  await sheet.getByRole("button", { name: "Add to shop" }).click();
  log(`added → toast "${await p.getByRole("status").innerText()}"`);
  const coll = await p.request.get(base + "/collection/napoli-test");
  html = await coll.text();
  const media = html.match(/\/media\/[a-z0-9]+(-\d+)?\.webp/)?.[0];
  log(`shop /collection/napoli-test → ${coll.status()}, lists it: ${html.includes("Napoli Test Retro")}, photo ${media}`);
  if (media) {
    const img = await p.request.get(base + media);
    log(`photo served → ${img.status()} ${img.headers()["content-type"]} ${img.headers()["cache-control"]}`);
  }
  const page = await p.request.get(base + "/product/napoli-test-retro");
  log(`product page /product/napoli-test-retro → ${page.status()}`);

  // ── categories: by hand, a new one; a new league with the team in it ──
  const napoli = p.getByRole("button", { name: /^Napoli Test Retro,/ }).first();
  await napoli.click();
  const ns = p.getByRole("dialog", { name: "Napoli Test Retro" });
  await ns.getByRole("button", { name: "New category" }).click();
  await p.getByPlaceholder("e.g. World Cup 2026, Kids, Sale").fill("Test Picks");
  await p.getByRole("button", { name: "Add category" }).click();
  await p.getByRole("alertdialog").waitFor({ state: "detached" });
  await ns.getByRole("button", { name: "Champions League", exact: true }).click();
  await shot(p, "12-where-it-shows-phone");
  await ns.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByRole("status").getByText("Saved. The shop shows it now.").waitFor();
  for (const c of ["test-picks", "champions-league", "retro"]) {
    const h = await (await p.request.get(base + "/collection/" + c)).text();
    log(`/collection/${c} lists Napoli Test Retro: ${h.includes("Napoli Test Retro")}`);
  }
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Categories & leagues/ }).click();
  const places = p.getByRole("dialog", { name: "Categories & leagues" });
  await places.getByPlaceholder("New league — e.g. Eredivisie").fill("Test League");
  await places.getByPlaceholder("New league — e.g. Eredivisie").press("Enter");
  await p.getByRole("status").getByText("Test League added").waitFor();
  await places.getByRole("combobox", { name: "League for Napoli Test" }).selectOption({ label: "Test League" });
  await p.getByRole("status").getByText("Napoli Test is in Test League now.").waitFor();
  await shot(p, "13-categories-leagues-phone");
  await p.keyboard.press("Escape");
  const lg = await p.request.get(base + "/league/test-league");
  const lgHtml = await lg.text();
  log(`/league/test-league → ${lg.status()}, lists Napoli Test: ${lgHtml.includes("Napoli Test")}`);
  const sa = await (await p.request.get(base + "/league/serie-a")).text();
  log(`/league/serie-a no longer lists Napoli Test: ${!sa.includes("Napoli Test")}`);

  // ── hide it ──
  const newCard = p.getByRole("button", { name: /^Napoli Test Retro,/ }).first();
  await newCard.click();
  await p.getByRole("switch", { name: "Show in the shop" }).click();
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByRole("status").getByText("Saved. The shop shows it now.").waitFor();
  log(`hidden → shop page ${(await p.request.get(base + "/product/napoli-test-retro")).status()}`);

  // ── delete, undo, delete, bring back from the room, delete ──
  await newCard.click();
  await p.getByRole("button", { name: "Delete" }).click();
  await p.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  log(`deleted → toast "${await p.getByRole("status").innerText()}"`);
  await p.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await p.getByText("is back in the shop").waitFor();
  log(`undo → back: ${await newCard.isVisible()}`);
  await newCard.click();
  await p.getByRole("button", { name: "Delete" }).click();
  await p.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await p.getByRole("status").waitFor();
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Deleted products/ }).click();
  await p.waitForTimeout(400);
  await shot(p, "06-deleted-room-phone");
  log(`deleted room lists it: ${await p.getByRole("dialog", { name: "Deleted products" }).getByText("Napoli Test Retro").isVisible()}`);
  await p.keyboard.press("Escape");

  // ── desktop look ──
  const d = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await d.addCookies(await ctx.cookies());
  const dp = await d.newPage();
  dp.on("pageerror", (e) => errs.push(String(e)));
  await dp.goto(base + "/admin", { waitUntil: "networkidle" });
  await dp.waitForTimeout(800);
  await dp.screenshot({ path: `${outDir}/07-products-desktop.png` });
  await dp.getByRole("button", { name: /^Barcelona Home 26\/27,/ }).first().click();
  await dp.waitForTimeout(600);
  await dp.screenshot({ path: `${outDir}/08-product-sheet-desktop.png` });
  await dp.keyboard.press("Escape");
  await dp.getByRole("button", { name: "Add a product" }).first().click();
  await dp.waitForTimeout(600);
  await dp.screenshot({ path: `${outDir}/09-new-product-desktop.png` });

  log(`console errors: ${errs.length ? [...new Set(errs)].slice(0, 6).join(" | ") : "none"}`);
  fs.writeFileSync(`${outDir}/admin-report.txt`, out.join("\n") + "\n");
  await b.close();
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
