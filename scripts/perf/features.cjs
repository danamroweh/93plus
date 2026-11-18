// Drives the ten additions on a running build and reports what actually happened.
// usage: node features.cjs <base> <outdir>
const { chromium, devices } = require("/Users/hadim/moodboard/node_modules/playwright");
const fs = require("node:fs");
const base = process.argv[2];
const outDir = process.argv[3] || ".";
const seen = () => localStorage.setItem("93plus:preloaded", String(Date.now()));
const barState = () =>
  [...document.querySelectorAll("div.fixed.inset-x-0.bottom-0")].at(-1)?.getBoundingClientRect().top < innerHeight ? "shown" : "hidden";

(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const out = [];

  // ── A. phone: photo sizes, sticky bar, optimistic add, size memory ──
  {
    const ctx = await b.newContext({ ...devices["iPhone 13"] });
    await ctx.addInitScript(seen);
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 120)));
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    await p.goto(base + "/", { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const imgs = await p.evaluate(() =>
      performance.getEntriesByType("resource").map((r) => r.name).filter((n) => /\/product\/.*\.webp/.test(n)).map((n) => n.replace(/^.*\/product\//, "").replace(/\?.*$/, "")),
    );
    const small = imgs.filter((n) => /\/s\//.test(n));
    const first = await p.evaluate(() => {
      const i = document.querySelector('img[data-image="front"]');
      return { srcset: Boolean(i && i.srcset), current: i ? i.currentSrc.replace(/^.*\/product\//, "").replace(/\?.*$/, "") : "?" };
    });
    out.push(`phone home photos: ${imgs.length} fetched, ${small.length} phone-size (${small[0] ?? "-"}) · first card picks ${first.current} · srcset=${first.srcset}`);

    await p.goto(base + "/product/liverpool-home-26-27", { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    const atLoad = await p.evaluate(barState);
    await p.evaluate(() => window.scrollTo(0, 1600));
    await p.waitForTimeout(600);
    const afterScroll = await p.evaluate(barState);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(600);
    const backUp = await p.evaluate(barState);
    out.push(`sticky add bar: at load ${atLoad} · scrolled past the button ${afterScroll} · back at top ${backUp}`);

    await p.getByRole("button", { name: "L", exact: true }).click();
    const t0 = Date.now();
    await p.getByRole("button", { name: "Add to cart" }).first().click();
    await p.getByRole("dialog", { name: "Cart" }).getByText("Liverpool Home 26/27").waitFor({ timeout: 5000 });
    const openMs = Date.now() - t0;
    await p.waitForTimeout(1500);
    const cart = (await p.getByRole("dialog", { name: "Cart" }).innerText()).split("\n").filter(Boolean);
    out.push(`optimistic add: shirt in the drawer after ${openMs} ms · ${cart[0]} · ${cart.find((l) => /·/.test(l)) ?? "?"}`);

    await p.keyboard.press("Escape");
    await p.goto(base + "/product/juventus-home-26-27", { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    const preselected = await p.getByRole("button", { name: "L", exact: true }).evaluate((el) => el.className.includes("bg-ink"));
    const usual = await p.getByText("Your usual size.").count();
    out.push(`size memory on the next shirt: L preselected=${preselected} · "Your usual size." shown=${usual > 0}`);
    out.push(`phone console errors: ${errs.length ? [...new Set(errs)].slice(0, 4).join(" | ") : "none"}`);
    await ctx.close();
  }

  // ── B. desktop: card → page morph, search ───────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => {
      localStorage.setItem("93plus:preloaded", String(Date.now()));
      window.__vt = 0;
      const orig = document.startViewTransition && document.startViewTransition.bind(document);
      if (orig) document.startViewTransition = (cb) => { window.__vt++; return orig(cb); };
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 120)));
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    await p.goto(base + "/collection/liverpool", { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    const t0 = Date.now();
    await p.locator('a[href^="/product/"]').first().click();
    await p.waitForURL(/\/product\//, { timeout: 8000 });
    await p.waitForTimeout(1200);
    const vt = await p.evaluate(() => window.__vt);
    const hero = await p.evaluate(() => { const el = document.querySelector('[style*="view-transition-name"]'); return el ? el.style.viewTransitionName : "none"; });
    out.push(`card → page morph: startViewTransition called ${vt}× · on ${p.url().replace(base, "")} after ${Date.now() - t0} ms · hero carries "${hero}"`);

    const search = async (text) => {
      await p.keyboard.press("/");
      await p.waitForTimeout(300);
      await p.keyboard.type(text);
      await p.waitForTimeout(400);
      const titles = await p.locator('[role="dialog"][aria-label="Search"] li p.t-title').allInnerTexts();
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
      return `${titles.length}: ${titles.slice(0, 3).join(" / ")}`;
    };
    for (const q of ["ronldo", "liverpol", "ميسي", "برشا", "ريال", "قميص"]) out.push(`search "${q}" → ${await search(q)}`);
    out.push(`desktop console errors: ${errs.length ? [...new Set(errs)].slice(0, 4).join(" | ") : "none"}`);
    await ctx.close();
  }

  // ── C. share image + order tracking ─────────────────────────────────
  {
    const ctx = await b.newContext({ ...devices["iPhone 13"] });
    await ctx.addInitScript(seen);
    const p = await ctx.newPage();
    const r = await p.request.get(base + "/product/real-madrid-home-26-27/opengraph-image");
    const buf = await r.body();
    fs.writeFileSync(`${outDir}/og-rm.png`, buf);
    await p.goto(base + "/product/real-madrid-home-26-27");
    const og = await p.evaluate(() => document.querySelector('meta[property="og:image"]')?.getAttribute("content"));
    out.push(`share image: ${r.status()} ${r.headers()["content-type"]} ${Math.round(buf.length / 1024)} KB · og:image → ${og}`);

    // Orders are kept in the store now (src/lib/store.ts → .data/orders/).
    const dir = "/Users/hadim/moodboard/93plus/.data/orders";
    const newest = fs.readdirSync(dir).map((f) => ({ f, t: fs.statSync(`${dir}/${f}`).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    const o = JSON.parse(fs.readFileSync(`${dir}/${newest.f}`, "utf8"));
    const last4 = o.phone.replace(/\D/g, "").slice(-4);
    await p.goto(base + "/order?n=" + o.number, { waitUntil: "load" }); await p.waitForTimeout(1500);
    const prefilled = await p.getByPlaceholder("93-1022-1234").inputValue();
    await p.getByPlaceholder("3456").fill(last4 === "0000" ? "1111" : "0000");
    await p.getByRole("button", { name: "Find my order" }).click();
    await p.waitForTimeout(3000);
    const wrong = await p.getByRole("alert").first().innerText().catch(() => "no error shown");
    await p.getByPlaceholder("3456").fill(last4);
    await p.getByRole("button", { name: "Find my order" }).click();
    await p.waitForTimeout(3000);
    const body = await p.locator("main").innerText();
    const shown = body.includes("Order " + o.number) && body.includes("Total");
    const leak = body.includes(o.name) || body.includes(o.phone) || body.includes(o.address);
    out.push(`order tracking: number prefilled=${prefilled === o.number} · wrong digits → "${wrong.slice(0, 48)}…" · right digits → status shown=${shown} · personal details on screen=${leak}`);
    await p.screenshot({ path: `${outDir}/order-phone.png`, fullPage: true });

    // cart skeleton: slow every server action by 2.5 s and open the cart at once
    await p.route("**/*", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await p.goto(base + "/", { waitUntil: "load" });
    await p.getByRole("button", { name: /^Cart \(/ }).click({ timeout: 10000 });
    await p.waitForTimeout(300);
    const skeleton = (await p.locator("[aria-busy=true]").count()) > 0;
    const emptyEarly = (await p.getByText("Nothing here yet.").count()) > 0;
    await p.waitForTimeout(3500);
    const skeletonLater = (await p.locator("[aria-busy=true]").count()) > 0;
    const emptyLater = (await p.getByText("Nothing here yet.").count()) > 0;
    out.push(`cart skeleton while the cart loads: shapes=${skeleton} "Nothing here yet"=${emptyEarly} · once loaded: shapes=${skeletonLater} empty-state=${emptyLater}`);
    await ctx.close();
  }

  await b.close();
  console.log(out.join("\n"));
})();
