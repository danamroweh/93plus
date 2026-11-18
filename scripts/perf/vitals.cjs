// Web Vitals on an emulated phone (iPhone 13, slow 4G, 4x CPU slowdown).
// usage: node vitals.cjs <base> <runs> <first|return> <comma-paths>
const { chromium, devices } = require("/Users/hadim/moodboard/node_modules/playwright");
const base = process.argv[2];
const runs = Number(process.argv[3] || 5);
const mode = process.argv[4] || "return";
const paths = (process.argv[5] || "/,/product/real-madrid-home-26-27,/collection/champions-league").split(",");

(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const out = {};
  for (const p of paths) {
    out[p] = [];
    for (let i = 0; i < runs; i++) {
      const ctx = await b.newContext({ ...devices["iPhone 13"] });
      if (mode === "return")
        await ctx.addInitScript(() => localStorage.setItem("93plus:preloaded", String(Date.now())));
      await ctx.addInitScript(() => {
        window.__m = { lcp: 0, cls: 0, tbt: 0, long: 0 };
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; })
          .observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; })
          .observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__m.long++; window.__m.tbt += Math.max(0, e.duration - 50); } })
          .observe({ type: "longtask", buffered: true });
      });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      let bytes = 0, reqs = 0;
      cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; reqs++; });
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
      page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(base, "")}`); });
      await page.goto(base + p, { waitUntil: "load" });
      await page.waitForTimeout(3500);
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const res = performance.getEntriesByType("resource");
        return {
          ...window.__m,
          ttfb: nav.responseStart,
          load: nav.loadEventEnd,
          imgs: res.filter((r) => /\.(webp|png|jpg|jpeg|gif)(\?|$)/.test(r.name)).length,
          hoverImgs: res.filter((r) => /02-hover/.test(r.name)).length,
          js: res.filter((r) => /\.js(\?|$)/.test(r.name)).reduce((n, r) => n + (r.encodedBodySize || 0), 0),
        };
      });
      m.bytes = bytes; m.reqs = reqs; m.errors = errors;
      out[p].push(m);
      await ctx.close();
    }
  }
  await b.close();
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.round(q * (s.length - 1)))]; };
  for (const p of paths) {
    const r = out[p];
    const f = (k) => `${Math.round(pct(r.map((x) => x[k]), 0.5))}/${Math.round(pct(r.map((x) => x[k]), 0.75))}/${Math.round(pct(r.map((x) => x[k]), 0.95))}`;
    console.log(`${p}  LCP p50/75/95 ${f("lcp")} ms · CLS p75 ${pct(r.map((x) => x.cls), 0.75).toFixed(3)} · TBT ${f("tbt")} ms · long tasks ${f("long")} · TTFB ${f("ttfb")} · load ${f("load")} · wire ${Math.round(pct(r.map((x) => x.bytes), 0.5) / 1024)} KB · reqs ${pct(r.map((x) => x.reqs), 0.5)} · imgs ${pct(r.map((x) => x.imgs), 0.5)} (hover ${pct(r.map((x) => x.hoverImgs), 0.5)}) · js ${Math.round(pct(r.map((x) => x.js), 0.5) / 1024)} KB`);
    const errs = [...new Set(r.flatMap((x) => x.errors))];
    if (errs.length) console.log(`   errors: ${errs.slice(0, 6).join(" | ")}`);
  }
})();
