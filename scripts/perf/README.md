# Perf and attack checks

Run against a production build (`npm run build && npm run start -- -p 3094`).
They drive Chrome through Playwright from the moodboard root's node_modules.

- `node scripts/perf/vitals.cjs http://localhost:3094 5 return` — LCP / CLS / TBT on an
  emulated iPhone over slow 4G with a 4× CPU slowdown, p50/p75/p95 over 5 runs.
  `first` instead of `return` plays the preloader.
- `node scripts/perf/attack.cjs http://localhost:3094` — tampered cart requests, a
  double-submitted order and a burst of orders. Writes then removes test rows in
  `orders.jsonl`.
- `node scripts/perf/hover.cjs http://localhost:3094` — confirms phones never download the
  hover frames and desktops fetch the first row early.
