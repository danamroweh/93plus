// Does a phone download the hover frames? And a desktop?
const { chromium, devices } = require("/Users/hadim/moodboard/node_modules/playwright");
const base = process.argv[2]; const path = process.argv[3] || "/collection/champions-league";
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  for (const [label, opts] of [["phone", { ...devices["iPhone 13"] }], ["desktop", { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => localStorage.setItem("93plus:preloaded", String(Date.now())));
    const page = await ctx.newPage();
    const urls = new Set();
    page.on("response", (r) => { if (/02-hover/.test(r.url())) urls.add(r.url()); });
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2500);
    const fronts = await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => /01-front/.test(r.name)).length);
    const hoverMatch = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
    console.log(`${label}: hover media=${hoverMatch} · hover frames downloaded=${urls.size} · fronts=${fronts}`);
    await ctx.close();
  }
  await b.close();
})();
