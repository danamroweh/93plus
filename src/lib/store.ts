import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 93+ · Storage
 *
 * Everything the shop editor changes — the product list, uploaded photos,
 * orders — lives here, behind one small interface with two backends:
 *
 *   file     a folder on disk (`.data/`, or DATA_DIR). This Mac, or any
 *            server that keeps its disk between restarts.
 *   netlify  Netlify Blobs (spoken to directly, see below). Picked
 *            automatically on Netlify, where the disk a function runs on is
 *            read-only and thrown away.
 *
 * STORE=file|netlify forces one. Keys look like paths: `catalogue.json`,
 * `media/k3x9….webp`, `orders/93-1118-4821.json`.
 */

type Json = unknown;

interface Backend {
  kind: "file" | "netlify";
  read(key: string): Promise<{ data: Buffer; type: string } | null>;
  write(key: string, data: Buffer, type: string): Promise<void>;
  readJSON<T>(key: string): Promise<{ value: T; etag: string | null } | null>;
  /**
   * Writes only if the entry is still at `etag` (`null`: only if it doesn't
   * exist yet). Returns false when someone else wrote first.
   */
  writeJSON(key: string, value: Json, etag: string | null | undefined): Promise<boolean>;
  remove(key: string): Promise<void>;
}

// ── files ─────────────────────────────────────────────────────────────

function fileBackend(): Backend {
  // turbopackIgnore: the data folder is read at runtime only; without the
  // hint the build traces the whole project into the server bundle.
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), ".data"));
  const full = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error(`Bad key: ${key}`);
    return p;
  };
  /** Write beside, then rename: a crash mid-write never leaves half a file. */
  const atomic = async (file: string, data: Buffer | string) => {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);
  };
  const types: Record<string, string> = {
    ".webp": "image/webp",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".png": "image/png",
  };
  return {
    kind: "file",
    async read(key) {
      try {
        const data = await readFile(/*turbopackIgnore: true*/ full(key));
        return { data, type: types[path.extname(key)] ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async write(key, data) {
      await atomic(full(key), data);
    },
    async readJSON<T>(key: string) {
      try {
        return { value: JSON.parse(await readFile(/*turbopackIgnore: true*/ full(key), "utf8")) as T, etag: null };
      } catch {
        return null;
      }
    },
    // One process owns the folder and `update` below queues writes per key,
    // so there is no one else to race.
    async writeJSON(key, value) {
      await atomic(full(key), JSON.stringify(value, null, 1));
      return true;
    },
    async remove(key) {
      await rm(full(key), { force: true });
    },
  };
}

// ── Netlify Blobs ─────────────────────────────────────────────────────
//
// Spoken to directly rather than through @netlify/blobs: v11 of that client
// wraps every call in a tracing layer that never resolves inside Netlify's
// Next.js server (every read hung until the 30 s function limit, Nov 18
// 2026), while the same HTTP request made by hand answers in ~25 ms. The
// protocol is small: GET / PUT / DELETE on
// `<edge>/<siteID>/site:<store>/<key>` with the site's token, the content
// type kept in the object's metadata header, ETags for conditional writes.
// Netlify hands every function the URLs and token in NETLIFY_BLOBS_CONTEXT.

type BlobsContext = { siteID: string; token: string; edgeURL: string; uncachedEdgeURL?: string };

function netlifyBackend(): Backend {
  const STORE = "site:93plus";
  const META = "x-amz-meta-user";
  let ctx: BlobsContext | null = null;
  const context = () => {
    if (ctx) return ctx;
    const raw = process.env.NETLIFY_BLOBS_CONTEXT;
    if (!raw) throw new Error("Netlify Blobs: NETLIFY_BLOBS_CONTEXT is missing (not running on Netlify?)");
    ctx = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as BlobsContext;
    return ctx;
  };
  // Next.js wraps fetch to cache and track it; a store read inside a page
  // render must not be mistaken for a page-level fetch, so use the original.
  const rawFetch: typeof fetch =
    (globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch })._nextOriginalFetch ?? fetch;

  /** Strong reads skip the edge cache, so an edit is read back at once. */
  async function call(method: string, key: string, init: { body?: Buffer | string; headers?: Record<string, string>; strong?: boolean } = {}) {
    const c = context();
    const base = init.strong && c.uncachedEdgeURL ? c.uncachedEdgeURL : c.edgeURL;
    const url = new URL(`/${c.siteID}/${STORE}/${key}`, base).toString();
    for (let attempt = 0; ; attempt++) {
      const res = await rawFetch(url, {
        method,
        body: init.body as BodyInit | undefined,
        headers: { authorization: `Bearer ${c.token}`, ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await res.body?.cancel();
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return res;
    }
  }

  const fail = async (res: Response, what: string) => {
    const detail = res.headers.get("x-nf-error") ?? (await res.text().catch(() => "")).slice(0, 120);
    return new Error(`Netlify Blobs ${what}: ${res.status} ${detail}`);
  };
  const meta = (type: string) => `b64;${Buffer.from(JSON.stringify({ type })).toString("base64")}`;
  const typeOf = (res: Response) => {
    const h = res.headers.get(META) ?? res.headers.get("netlify-blobs-metadata") ?? "";
    try {
      return h.startsWith("b64;") ? String(JSON.parse(Buffer.from(h.slice(4), "base64").toString("utf8")).type ?? "") : "";
    } catch {
      return "";
    }
  };
  const put = (key: string, body: Buffer | string, type: string, extra: Record<string, string> = {}) =>
    call("PUT", key, {
      body,
      headers: { "cache-control": "max-age=0, stale-while-revalidate=60", [META]: meta(type), ...extra },
    });

  return {
    kind: "netlify",
    async read(key) {
      // Media never changes under a name, so the cached edge is right here.
      const res = await call("GET", key);
      if (res.status === 404) return null;
      if (!res.ok) throw await fail(res, `read ${key}`);
      return { data: Buffer.from(await res.arrayBuffer()), type: typeOf(res) || "application/octet-stream" };
    },
    async write(key, data, type) {
      const res = await put(key, data, type);
      if (!res.ok) throw await fail(res, `write ${key}`);
    },
    async readJSON<T>(key: string) {
      const res = await call("GET", key, { strong: true });
      if (res.status === 404) return null;
      if (!res.ok) throw await fail(res, `read ${key}`);
      return { value: JSON.parse(await res.text()) as T, etag: res.headers.get("etag") };
    },
    async writeJSON(key, value, etag) {
      const condition: Record<string, string> =
        etag === undefined ? {} : etag === null ? { "if-none-match": "*" } : { "if-match": etag };
      const res = await put(key, JSON.stringify(value), "application/json", condition);
      if (res.status === 412 || res.status === 409) return false;
      if (!res.ok) throw await fail(res, `write ${key}`);
      return true;
    },
    async remove(key) {
      const res = await call("DELETE", key);
      if (!res.ok && res.status !== 404) throw await fail(res, `delete ${key}`);
    },
  };
}

// ── the one in use ────────────────────────────────────────────────────

function pick(): Backend {
  const forced = process.env.STORE;
  if (forced === "netlify") return netlifyBackend();
  if (forced === "file") return fileBackend();
  return process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY ? netlifyBackend() : fileBackend();
}

const backend = pick();

export const storeKind = backend.kind;

export function readBytes(key: string) {
  return backend.read(key);
}

export function writeBytes(key: string, data: Buffer, type: string) {
  return backend.write(key, data, type);
}

export async function readJSON<T>(key: string): Promise<T | null> {
  return (await backend.readJSON<T>(key))?.value ?? null;
}

export function writeJSON(key: string, value: Json) {
  return backend.writeJSON(key, value, undefined);
}

/** Writes only if nothing is stored under `key` yet. */
export function createJSON(key: string, value: Json) {
  return backend.writeJSON(key, value, null);
}

export function removeKey(key: string) {
  return backend.remove(key);
}

/**
 * Read, change, write — without losing a write that landed in between.
 * Inside one process, updates to a key queue up. Across machines (Netlify),
 * the write only lands if the entry is unchanged since it was read; if
 * someone got there first, read again and redo the change.
 */
const queues = new Map<string, Promise<unknown>>();

export function update<T>(key: string, change: (current: T | null) => T): Promise<T> {
  const run = async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const hit = await backend.readJSON<T>(key);
      const next = change(hit ? structuredClone(hit.value) : null);
      const etag = backend.kind === "file" ? undefined : (hit?.etag ?? null);
      if (await backend.writeJSON(key, next, etag)) return next;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120 * (attempt + 1)));
    }
    throw new Error(`Couldn't save ${key}: it kept changing underneath.`);
  };
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(run, run);
  queues.set(
    key,
    next.catch(() => {}),
  );
  return next;
}
