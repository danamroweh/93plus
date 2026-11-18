// Records how the card reveal, the cursor and the cart sparkle move, frame by
// frame, so a rewrite can be checked against the original by numbers.
// usage: node scripts/perf/motion.cjs <base> <out.json>
const { chromium } = require("/Users/hadim/moodboard/node_modules/playwright");
const fs = require("node:fs");
const base = process.argv[2];
const outFile = process.argv[3];

/** Sample `fn` every animation frame for `ms`, from the page. */
const sampler = (fn, ms) => `
  new Promise((resolve) => {
    const out = []; const t0 = performance.now();
    const tick = () => { const t = performance.now() - t0; out.push([Math.round(t), ...(${fn})()]);
      t < ${ms} ? requestAnimationFrame(tick) : resolve(out); };
    tick();
  })`;

(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("93plus:preloaded", String(Date.now())));
  const p = await ctx.newPage();
  const result = {};

  // ── card reveal: first card, panel x-fraction and front scale/x ─────
  await p.goto(base + "/", { waitUntil: "domcontentloaded" });
  result.reveal = await p.evaluate(sampler(`() => {
    const card = document.querySelector("[data-product]");
    const panel = card && card.querySelector("[data-reveal-panel]");
    const front = card && card.querySelector('[data-image="front"]');
    if (!panel || !front) return [null, null, null];
    const m1 = new DOMMatrix(getComputedStyle(panel).transform);
    const m2 = new DOMMatrix(getComputedStyle(front).transform);
    return [+(m1.m41 / panel.offsetWidth).toFixed(3), +m2.a.toFixed(3), +(m2.m41 / front.offsetWidth).toFixed(3)];
  }`, 2600));

  // ── cursor: jump the pointer and watch the dot follow ───────────────
  await p.mouse.move(200, 200);
  await p.waitForTimeout(400);
  await p.mouse.move(210, 210);
  await p.waitForTimeout(1200);
  const follow = p.evaluate(sampler(`() => {
    const dot = document.querySelector(".pointer-events-none.fixed.top-0.left-0 > div");
    if (!dot) return [null, null];
    const m = new DOMMatrix(getComputedStyle(dot).transform);
    return [Math.round(m.m41), Math.round(m.m42)];
  }`, 1200));
  await p.mouse.move(810, 510);
  result.cursor = await follow;

  // ── cart sparkle: add a mug, watch the mark in the drawer header ────
  await p.goto(base + "/product/real-madrid-mug", { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const spark = p.evaluate(sampler(`() => {
    const el = document.querySelector("aside[aria-label=Cart] h2 + div");
    if (!el) return [null, null, null];
    const cs = getComputedStyle(el);
    const m = new DOMMatrix(cs.transform);
    return [+Math.hypot(m.a, m.b).toFixed(3), Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI), +(+cs.opacity * (cs.visibility === "hidden" ? 0 : 1)).toFixed(2)];
  }`, 1400));
  await p.getByRole("button", { name: "Add to cart" }).click();
  result.sparkle = await spark;

  await b.close();
  fs.writeFileSync(outFile, JSON.stringify(result));
  const at = (series, ms) => series.find((s) => s[0] >= ms) ?? series[series.length - 1];
  const startOf = (series, idx, rest) => series.findIndex((s) => s[idx] !== null && s[idx] !== rest);
  // reveal: express against the moment the panel starts moving
  const r = result.reveal; const r0 = startOf(r, 1, 0); const rt0 = r0 >= 0 ? r[r0][0] : 0;
  const rv = [0, 100, 200, 400, 700, 1000].map((d) => { const s = at(r, rt0 + d); return `+${d}ms panel ${s[1]} scale ${s[2]} x ${s[3]}`; });
  console.log("reveal  (from first move):", rv.join(" | "));
  const c = result.cursor; const c0 = c.findIndex((s, i) => i > 0 && s[1] !== c[0][1]); const ct0 = c0 >= 0 ? c[c0][0] : 0;
  console.log("cursor  (from first move):", [0, 50, 100, 200, 400, 800].map((d) => { const s = at(c, ct0 + d); return `+${d}ms ${s[1]},${s[2]}`; }).join(" | "));
  const s = result.sparkle; const s0 = s.findIndex((x) => x[3] > 0); const st0 = s0 >= 0 ? s[s0][0] : 0;
  console.log("sparkle (from appearing):", [0, 100, 250, 500, 800, 1000].map((d) => { const x = at(s, st0 + d); return `+${d}ms scale ${x[1]} rot ${x[2]} op ${x[3]}`; }).join(" | "));
})();
