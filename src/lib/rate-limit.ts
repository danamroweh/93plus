import { headers } from "next/headers";

/**
 * 93+ · Rate limits
 *
 * Token buckets in memory, keyed by client address. Right for one machine,
 * which is what this shop runs on; on several machines they'd move to a
 * shared store (Redis) so every machine counts the same visitor together.
 *
 * Behind a CDN or proxy the first `x-forwarded-for` entry is the visitor;
 * straight from the LAN there's no header, so everyone counts as one.
 */

type Bucket = { tokens: number; at: number };

const buckets = new Map<string, Bucket>();
/** Forget stale addresses before the map can grow without bound. */
const MAX_KEYS = 20_000;

export async function clientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}

/**
 * True when this call is within the limit: `limit` calls, refilling evenly
 * over `perMs`. A caller over the limit is refused, never queued.
 */
export function allow(key: string, limit: number, perMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_KEYS)
    for (const [k, b] of buckets) if (now - b.at > perMs) buckets.delete(k);

  const b = buckets.get(key) ?? { tokens: limit, at: now };
  b.tokens = Math.min(limit, b.tokens + ((now - b.at) / perMs) * limit);
  b.at = now;
  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;
  buckets.set(key, b);
  return ok;
}
