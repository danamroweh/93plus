/**
 * Temporary: how the store connects on this host. Booleans and timings
 * only — no values, no keys.
 */
export const dynamic = "force-dynamic";

const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([
    p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, error: String((e as Error)?.name ?? e) + ": " + String((e as Error)?.message ?? "").slice(0, 160) }),
    ),
    new Promise<{ ok: false; error: string }>((r) => setTimeout(() => r({ ok: false, error: "timeout" }), ms)),
  ]);

export async function GET() {
  const out: Record<string, unknown> = {
    env: {
      NETLIFY: Boolean(process.env.NETLIFY),
      NETLIFY_BLOBS_CONTEXT: Boolean(process.env.NETLIFY_BLOBS_CONTEXT),
      globalContext: typeof (globalThis as Record<string, unknown>).netlifyBlobsContext,
      STORE: process.env.STORE ?? null,
      SITE_ID: Boolean(process.env.SITE_ID),
    },
  };
  const t0 = Date.now();
  const mod = await within(import("@netlify/blobs"), 5000);
  out.importMs = Date.now() - t0;
  out.import = mod.ok ? "ok" : mod.error;
  if (mod.ok) {
    const { getStore } = mod.v;
    for (const consistency of ["eventual", "strong"] as const) {
      const t = Date.now();
      const r = await within(
        (async () => {
          const s = getStore({ name: "93plus", consistency });
          return (await s.get("catalogue.json")) === null ? "missing" : "found";
        })(),
        6000,
      );
      out[consistency] = { ms: Date.now() - t, ...(r.ok ? { result: r.v } : { error: r.error }) };
    }
    const t = Date.now();
    const raw = await within(
      (async () => {
        const s = getStore({ name: "93plus", consistency: "strong", fetch: (...a: Parameters<typeof fetch>) => fetch(a[0], { ...a[1], cache: "no-store" }) });
        return (await s.get("catalogue.json")) === null ? "missing" : "found";
      })(),
      6000,
    );
    out.strongNoStore = { ms: Date.now() - t, ...(raw.ok ? { result: raw.v } : { error: raw.error }) };
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
