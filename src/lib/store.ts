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
 *   netlify  Netlify Blobs. Picked automatically on Netlify, where the disk
 *            a function runs on is read-only and thrown away.
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
  const root = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), ".data"));
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
        const data = await readFile(full(key));
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
        return { value: JSON.parse(await readFile(full(key), "utf8")) as T, etag: null };
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

function netlifyBackend(): Backend {
  // Loaded lazily so the file backend never pulls the client in.
  const store = import("@netlify/blobs").then(({ getStore }) =>
    getStore({ name: "93plus", consistency: "strong" }),
  );
  return {
    kind: "netlify",
    async read(key) {
      const hit = await (await store).getWithMetadata(key, { type: "arrayBuffer" });
      if (!hit) return null;
      const type = String(hit.metadata?.type ?? "application/octet-stream");
      return { data: Buffer.from(hit.data), type };
    },
    async write(key, data, type) {
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      await (await store).set(key, bytes as ArrayBuffer, { metadata: { type } });
    },
    async readJSON<T>(key: string) {
      const hit = await (await store).getWithMetadata(key, { type: "json" });
      return hit ? { value: hit.data as T, etag: hit.etag ?? null } : null;
    },
    async writeJSON(key, value, etag) {
      const s = await store;
      if (etag === undefined) {
        await s.setJSON(key, value);
        return true;
      }
      const res = etag === null
        ? await s.setJSON(key, value, { onlyIfNew: true })
        : await s.setJSON(key, value, { onlyIfMatch: etag });
      return res.modified;
    },
    async remove(key) {
      await (await store).delete(key);
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
