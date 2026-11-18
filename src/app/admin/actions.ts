"use server";

import { LEAGUES, PRICES, type Item, type Kit } from "@/lib/commerce/catalogue";
import {
  CODE_HANDLES,
  codeEntry,
  entriesOf,
  hasVersions,
  loadDoc,
  mutate,
  stockKeys,
  teamsOf,
  type Doc,
  type Entry,
  type Stock,
  type StoredPhoto,
} from "@/lib/commerce/inventory";
import { isShootPhoto, shootPhotos } from "@/lib/commerce/photos";
import { refreshShop } from "@/lib/commerce/refresh";
import { readJSON } from "@/lib/store";
import { isAdmin, signIn, signOut, type SignInResult } from "@/lib/admin/session";
import { effectivePrices, snapshotOf, toAdmin } from "@/lib/admin/data";
import { ITEMS, KITS, type AdminProduct, type AdminSnapshot, type AdminTeam, type ProductInput } from "@/lib/admin/types";

/**
 * Everything the shop editor changes goes through these. Each one checks
 * the sign-in first, trusts nothing the page sends (lengths, prices, stock,
 * photo paths are all re-checked here), saves, and marks the shop's pages
 * stale so the change is live on the next visit.
 */

type Fail = { ok: false; error: string };
const SIGNED_OUT: Fail = { ok: false, error: "You're signed out. Reload the page and sign in again." };

export async function signInAction(password: string): Promise<SignInResult> {
  return signIn(password);
}

export async function signOutAction() {
  await signOut();
}

export async function snapshotAction(): Promise<AdminSnapshot | null> {
  if (!(await isAdmin())) return null;
  return snapshotOf(await loadDoc());
}

// ── checking what the page sent ───────────────────────────────────────

const text = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Cents, whole, $1 to $1,000. */
function price(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 100 && n <= 100_000 ? n : null;
}

function cleanStock(v: unknown, keys: string[]): Stock {
  const s = (v ?? {}) as { track?: unknown; off?: unknown; qty?: unknown };
  if (s.track === true) {
    const given = (s.qty && typeof s.qty === "object" ? s.qty : {}) as Record<string, unknown>;
    const qty: Record<string, number> = {};
    for (const k of keys) qty[k] = Math.max(0, Math.min(9999, Math.floor(Number(given[k]) || 0)));
    return { track: true, qty };
  }
  const off = Array.isArray(s.off) ? keys.filter((k) => (s.off as unknown[]).includes(k)) : [];
  return off.length ? { track: false, off } : { track: false };
}

const ROLES = new Set(["front", "hover", "back", "detail"]);
const MEDIA = /^\/media\/([a-z0-9]{10,40})\.webp$/;

async function cleanPhotos(v: unknown): Promise<StoredPhoto[] | null> {
  if (!Array.isArray(v)) return [];
  const out: StoredPhoto[] = [];
  for (const raw of v.slice(0, 8)) {
    const url = String((raw as { url?: unknown })?.url ?? "");
    const r = String((raw as { role?: unknown })?.role ?? "");
    const role = ROLES.has(r) ? (r as StoredPhoto["role"]) : undefined;
    if (MEDIA.test(url)) {
      const meta = await readJSON<{ srcSet?: string; blur?: string }>(`media/${url.match(MEDIA)![1]}.json`);
      if (!meta) return null; // an upload that never finished
      out.push({ url, ...(role && { role }), ...(meta.srcSet && { srcSet: meta.srcSet }), ...(meta.blur && { blur: meta.blur }) });
    } else if (isShootPhoto(url)) {
      out.push({ url, ...(role && { role }) });
    } else return null;
  }
  return out;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function freeHandle(base: string, taken: Set<string>) {
  const root = base || "product";
  let handle = root;
  for (let i = 2; taken.has(handle); i++) handle = `${root}-${i}`;
  return handle;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ── products ──────────────────────────────────────────────────────────

export type SaveResult = { ok: true; product: AdminProduct } | Fail;

export async function saveProductAction(input: ProductInput): Promise<SaveResult> {
  if (!(await isAdmin())) return SIGNED_OUT;

  const kind = input?.kind === "printable" ? "printable" : "shirt";
  const kit: Kit | null = kind === "shirt" ? (KITS.includes(input.kit as Kit) ? (input.kit as Kit) : null) : null;
  const item: Item | null = kind === "printable" ? (ITEMS.includes(input.item as Item) ? (input.item as Item) : null) : null;
  if (kind === "shirt" && !kit) return { ok: false, error: "Pick what kind of shirt it is." };
  if (kind === "printable" && !item) return { ok: false, error: "Pick what it is — keychain, mug or pillow." };

  const title = text(input.title, 80);
  if (title.length < 2) return { ok: false, error: "Give it a name." };
  const description = text(input.description, 400);

  const fan = kind === "shirt" ? price(input.fan) : null;
  const player = kind === "shirt" && hasVersions(kit!) ? price(input.player) : null;
  const cents = kind === "printable" ? price(input.cents) : null;
  if (kind === "shirt" && fan === null) return { ok: false, error: "Check the price — between $1 and $1,000." };
  if (kind === "shirt" && hasVersions(kit!) && player === null)
    return { ok: false, error: "Check the Player price — between $1 and $1,000." };
  if (kind === "printable" && cents === null) return { ok: false, error: "Check the price — between $1 and $1,000." };

  const stock = cleanStock(input.stock, stockKeys({ kind, kit: kit ?? undefined }));
  const photos = await cleanPhotos(input.photos);
  if (!photos) return { ok: false, error: "A photo didn't finish uploading. Add it again." };

  const doc = await loadDoc();
  const team = input.team && input.team in teamsOf(doc) ? input.team : null;
  const hidden = Boolean(input.hidden);
  const now = new Date().toISOString();

  // The editable fields, as they should now be.
  const next: Partial<Entry> = {
    title,
    description,
    team: team ?? undefined,
    kind,
    kit: kit ?? undefined,
    item: item ?? undefined,
    fan: fan ?? undefined,
    player: player ?? undefined,
    cents: cents ?? undefined,
    stock,
    hidden,
    photos,
  };

  let handle: string;
  const isNew = !input.handle;
  if (isNew) {
    const taken = new Set([...entriesOf(doc).map((e) => e.handle), ...Object.keys(doc.products)]);
    handle = freeHandle(slug(title), taken);
  } else {
    handle = String(input.handle);
    if (!entriesOf(doc).some((e) => e.handle === handle))
      return { ok: false, error: "That product isn't there any more. Reload the page." };
  }

  const saved = await mutate((d: Doc) => {
    if (isNew) {
      d.products[handle] = {
        handle,
        ...next,
        description: description || defaultDescription(title, kind),
        createdAt: now,
        updatedAt: now,
      };
      return;
    }
    if (!CODE_HANDLES.has(handle)) {
      d.products[handle] = { ...d.products[handle], ...next, handle, updatedAt: now };
      return;
    }
    // A product from code keeps only what differs from code, so anything the
    // editor never touched still follows the code list.
    const code = codeEntry(handle)!;
    const base: Record<string, unknown> = {
      ...code,
      ...effectivePrices(code),
      stock: code.stock ?? { track: false },
      hidden: false,
      photos: shootPhotos(handle),
    };
    const kept: Partial<Entry> & { handle: string } = { handle, updatedAt: now };
    for (const [k, v] of Object.entries(next) as [keyof Entry, unknown][]) {
      if (!same(normaliseField(k, v), normaliseField(k, base[k])))
        (kept as Record<string, unknown>)[k] = v;
    }
    const deleted = d.products[handle]?.deleted;
    d.products[handle] = { ...kept, ...(deleted && { deleted }) };
  });

  refreshShop();
  const entry = entriesOf(saved).find((e) => e.handle === handle)!;
  return { ok: true, product: toAdmin(entry) };
}

/** null and "nothing" are the same thing when deciding what changed. */
function normaliseField(k: keyof Entry, v: unknown) {
  if (k === "stock") {
    const s = (v ?? { track: false }) as Stock;
    return s.track ? s : { track: false, off: [...(s.off ?? [])].sort() };
  }
  if (k === "photos") return ((v ?? []) as StoredPhoto[]).map((p) => [p.url, p.role ?? null]);
  if (k === "hidden") return Boolean(v);
  return v ?? null;
}

function defaultDescription(title: string, kind: "shirt" | "printable") {
  return kind === "shirt" ? `${title}. Ships as a full set.` : `${title}.`;
}

export async function deleteProductAction(handle: string): Promise<{ ok: true } | Fail> {
  if (!(await isAdmin())) return SIGNED_OUT;
  const doc = await loadDoc();
  if (!entriesOf(doc).some((e) => e.handle === handle)) return { ok: false, error: "It's already gone." };
  await mutate((d) => {
    d.products[handle] = {
      ...(d.products[handle] ?? { handle }),
      deleted: new Date().toISOString(),
    };
  });
  refreshShop();
  return { ok: true };
}

export async function restoreProductAction(handle: string): Promise<SaveResult> {
  if (!(await isAdmin())) return SIGNED_OUT;
  const saved = await mutate((d) => {
    const s = d.products[handle];
    if (!s) return;
    delete s.deleted;
    // An edit to a code product that is now just "not deleted" is no edit.
    if (CODE_HANDLES.has(handle) && Object.keys(s).every((k) => k === "handle" || k === "updatedAt"))
      delete d.products[handle];
  });
  refreshShop();
  const entry = entriesOf(saved).find((e) => e.handle === handle);
  return entry ? { ok: true, product: toAdmin(entry) } : { ok: false, error: "Couldn't find it." };
}

// ── settings and teams ────────────────────────────────────────────────

export async function savePrintingAction(cents: number): Promise<{ ok: true; printing: number } | Fail> {
  if (!(await isAdmin())) return SIGNED_OUT;
  const n = Math.round(Number(cents));
  if (!Number.isFinite(n) || n < 0 || n > 10_000)
    return { ok: false, error: "Check the price — between $0 and $100." };
  await mutate((d) => {
    if (n === PRICES.printing) delete d.settings.printing;
    else d.settings.printing = n;
  });
  refreshShop();
  return { ok: true, printing: n };
}

export async function addTeamAction(
  title: string,
  league: string,
): Promise<{ ok: true; team: AdminTeam } | Fail> {
  if (!(await isAdmin())) return SIGNED_OUT;
  const name = text(title, 40);
  if (name.length < 2) return { ok: false, error: "Type the team's name." };
  if (!LEAGUES.some((l) => l.handle === league)) return { ok: false, error: "Pick a league." };
  const doc = await loadDoc();
  const names = teamsOf(doc);
  if (Object.values(names).some((t) => t.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: `${name} is already in the list.` };
  const handle = freeHandle(slug(name), new Set(Object.keys(names)));
  await mutate((d) => {
    d.teams[handle] = { title: name, league };
  });
  // No refresh: a team shows in the shop once it has a product.
  return { ok: true, team: { handle, title: name, league } };
}
