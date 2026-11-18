/**
 * Temporary: how the store connects on this host. Key names, booleans and
 * timings only — no values.
 */
export const dynamic = "force-dynamic";

type R = { ok: true; v: unknown } | { ok: false; error: string };
const within = (p: Promise<unknown>, ms: number): Promise<R> =>
  Promise.race([
    p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, error: `${(e as Error)?.name}: ${String((e as Error)?.message ?? e).slice(0, 200)}` }),
    ),
    new Promise<R>((r) => setTimeout(() => r({ ok: false, error: "timeout" }), ms)),
  ]);

async function timed(label: string, out: Record<string, unknown>, p: () => Promise<unknown>, ms = 5000) {
  const t = Date.now();
  const r = await within(p(), ms);
  out[label] = { ms: Date.now() - t, ...(r.ok ? { result: r.v } : { error: r.error }) };
}

export async function GET() {
  const out: Record<string, unknown> = {};
  try {
    const raw = process.env.NETLIFY_BLOBS_CONTEXT ?? "";
    const ctx = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
    out.contextKeys = Object.keys(ctx).sort();
    out.contextHosts = ["edgeURL", "uncachedEdgeURL", "apiURL", "url"].flatMap((k) =>
      typeof ctx[k] === "string" ? [`${k}=${new URL(ctx[k] as string).host}`] : [],
    );
  } catch (e) {
    out.contextKeys = `unreadable: ${String(e).slice(0, 80)}`;
  }
  const original = (globalThis.fetch as unknown as { _nextOriginalFetch?: typeof fetch })._nextOriginalFetch;
  out.hasOriginalFetch = typeof original === "function";

  await timed("pingPatched", out, async () => (await fetch("https://www.google.com/generate_204", { cache: "no-store" })).status);
  if (original) await timed("pingOriginal", out, async () => (await original("https://www.google.com/generate_204")).status);

  // One raw request, no retries: what the store server actually answers.
  try {
    const ctx = JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT ?? "", "base64").toString("utf8")) as Record<string, string>;
    for (const [label, base] of [["rawEdge", ctx.edgeURL], ["rawUncached", ctx.uncachedEdgeURL]] as const) {
      if (!base) continue;
      await timed(label, out, async () => {
        const res = await (original ?? fetch)(new URL(`/${ctx.siteID}/site:93plus/catalogue.json`, base).toString(), {
          headers: { authorization: `Bearer ${ctx.token}` },
        });
        const body = (await res.text()).slice(0, 160);
        return { status: res.status, nfError: res.headers.get("x-nf-error"), body };
      });
    }
  } catch (e) {
    out.raw = String(e).slice(0, 120);
  }
  const { getStore } = await import("@netlify/blobs");
  await timed("blobsPatched", out, async () => ((await getStore({ name: "93plus" }).get("catalogue.json")) === null ? "missing" : "found"));
  if (original)
    await timed("blobsOriginal", out, async () =>
      (await getStore({ name: "93plus", fetch: original }).get("catalogue.json")) === null ? "missing" : "found",
    );
  if (original)
    await timed("blobsOriginalStrong", out, async () =>
      (await getStore({ name: "93plus", consistency: "strong", fetch: original }).get("catalogue.json")) === null ? "missing" : "found",
    );
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
