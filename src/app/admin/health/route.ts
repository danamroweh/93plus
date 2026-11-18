import { readBytes, readJSON, removeKey, storeKind, update, writeJSON } from "@/lib/store";

/**
 * Temporary: does the store work on this host? Timings and yes/no only,
 * on a throwaway key.
 */
export const dynamic = "force-dynamic";

async function timed(label: string, out: Record<string, unknown>, fn: () => Promise<unknown>) {
  const t = Date.now();
  try {
    out[label] = { ms: Date.now() - t, result: await fn() };
    (out[label] as { ms: number }).ms = Date.now() - t;
  } catch (e) {
    out[label] = { ms: Date.now() - t, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

export async function GET() {
  const out: Record<string, unknown> = { storeKind };
  const stamp = Date.now();
  await timed("readCatalogue", out, async () => ((await readJSON("catalogue.json")) ? "found" : "missing"));
  await timed("write", out, async () => (await writeJSON("health/check.json", { stamp }), "ok"));
  await timed("readBack", out, async () => (await readJSON<{ stamp: number }>("health/check.json"))?.stamp === stamp);
  await timed("update", out, async () => (await update<{ n: number }>("health/count.json", (c) => ({ n: (c?.n ?? 0) + 1 }))).n);
  await timed("missingMedia", out, async () => ((await readBytes("media/nothing.webp")) === null ? "404 ok" : "found?"));
  await timed("cleanup", out, async () => (await removeKey("health/check.json"), "ok"));
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
