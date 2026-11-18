"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import {
  hasVersions,
  soldOut,
  stockLeft,
  type AdminProduct,
  type AdminSnapshot,
} from "@/lib/admin/types";
import {
  restoreProductAction,
  savePrintingAction,
  signOutAction,
  snapshotAction,
} from "@/app/admin/actions";
import { cn, normalise } from "@/lib/utils";
import {
  Button,
  IconBack,
  IconClose,
  IconEyeOff,
  IconOut,
  IconPlus,
  IconSearch,
  IconTrash,
  IconButton,
  Label,
  Menu,
  PriceInput,
  Sheet,
  Spinner,
  Toast,
  money,
  type ToastState,
} from "./parts";
import { ProductSheet } from "./ProductSheet";

type Filter = "all" | "shirts" | "retro" | "long" | "tracksuits" | "accessories" | "hidden" | "soldout";

const FILTERS: { id: Filter; label: string; test: (p: AdminProduct) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "shirts", label: "Shirts", test: (p) => p.kind === "shirt" && hasVersions(p.kit) },
  { id: "retro", label: "Retro", test: (p) => p.kit === "Retro" },
  { id: "long", label: "Long sleeves", test: (p) => p.kit === "Long sleeve" },
  { id: "tracksuits", label: "Tracksuits", test: (p) => p.kit === "Tracksuit" },
  { id: "accessories", label: "Accessories", test: (p) => p.kind === "printable" },
  { id: "hidden", label: "Hidden", test: (p) => p.hidden },
  { id: "soldout", label: "Sold out", test: (p) => soldOut(p) },
];

export const priceLine = (p: AdminProduct) =>
  p.kind === "printable"
    ? money(p.cents ?? 0)
    : p.player
      ? `${money(p.fan ?? 0)} · ${money(p.player)}`
      : money(p.fan ?? 0);

/**
 * The shop editor's one main room: every product as it looks in the shop,
 * a search, a row of filters, and one button to add. Tapping a product opens
 * it. Deleted products and the printing price live in their own rooms,
 * behind ⋯, so this room only ever shows the shop.
 */
export function Editor({ initial }: { initial: AdminSnapshot }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [room, setRoom] = useState<null | "deleted" | "settings">(null);
  const [toast, setToast] = useState<ToastState>(null);

  const live = useMemo(() => data.products.filter((p) => !p.deleted), [data.products]);
  const deleted = useMemo(
    () => data.products.filter((p) => p.deleted).sort((a, b) => (b.deleted ?? "").localeCompare(a.deleted ?? "")),
    [data.products],
  );
  const teamWords = useMemo(
    () => new Map(data.teams.map((t) => [t.handle, [t.title, ...(t.aliases ?? [])].join(" ")])),
    [data.teams],
  );

  const words = normalise(query).split(" ").filter(Boolean);
  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = live.filter((p) => {
    if (!active.test(p)) return false;
    if (!words.length) return true;
    const hay = normalise(
      [p.title, teamWords.get(p.team ?? "") ?? "", p.kit ?? "", p.item ?? "", p.hidden ? "hidden" : ""].join(" "),
    );
    return words.every((w) => hay.includes(w));
  });

  // Someone else (Hadi, Dana) may have changed things in another tab or on
  // another phone. Coming back to this tab picks that up — unless a product
  // is open, where it would pull the rug.
  const refresh = useCallback(async () => {
    const next = await snapshotAction().catch(() => null);
    if (next) setData(next);
    else window.location.reload();
  }, []);
  useEffect(() => {
    if (open || room) return;
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [open, room, refresh]);

  const upsert = (p: AdminProduct) =>
    setData((d) => {
      const at = d.products.findIndex((x) => x.handle === p.handle);
      const products = at === -1 ? [p, ...d.products] : d.products.map((x, i) => (i === at ? p : x));
      return { ...d, products };
    });

  async function restore(p: AdminProduct) {
    const res = await restoreProductAction(p.handle).catch(() => null);
    if (res?.ok) {
      upsert(res.product);
      setToast({ text: `${res.product.title} is back in the shop.` });
    } else setToast({ text: res?.error ?? "Couldn't bring it back. Try again." });
  }

  const current = open && open !== "new" ? data.products.find((p) => p.handle === open) : null;
  const hiddenCount = live.filter((p) => p.hidden).length;
  const soldOutCount = live.filter((p) => soldOut(p)).length;

  return (
    <div className="min-h-full pb-32">
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 lg:px-8">
          <Logo className="w-11 text-ink" />
          <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-ink-dim">Shop editor</span>
          <div className="ml-auto flex items-center gap-1">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden h-11 items-center gap-2 px-3 text-[14px] font-medium uppercase tracking-[0.04em] text-ink-dim hover:text-ink sm:inline-flex"
            >
              Open the shop <IconOut className="h-4 w-4" />
            </a>
            <Menu
              items={[
                { label: "Open the shop", icon: <IconOut />, href: "/" },
                {
                  label: "Deleted products",
                  icon: <IconTrash />,
                  badge: deleted.length ? String(deleted.length) : undefined,
                  onClick: () => setRoom("deleted"),
                },
                { label: "Printing price", icon: <span className="text-[17px] font-medium">$</span>, onClick: () => setRoom("settings") },
                {
                  label: "Sign out",
                  icon: <IconBack />,
                  onClick: async () => {
                    await signOutAction();
                    window.location.reload();
                  },
                },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pt-8 lg:px-8 lg:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="t-display text-[clamp(2.75rem,8vw,5rem)] text-ink">Products</h1>
            <p className="mt-3 text-[16px] text-ink-dim">
              {live.length} in the shop
              {hiddenCount > 0 && ` · ${hiddenCount} hidden`}
              {soldOutCount > 0 && ` · ${soldOutCount} sold out`}
            </p>
          </div>
          <Button tone="primary" size="lg" onClick={() => setOpen("new")} className="hidden sm:inline-flex">
            <IconPlus /> Add a product
          </Button>
        </div>

        <div className="sticky top-16 z-10 -mx-4 mt-8 bg-ground/95 px-4 pt-2 pb-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
          <label className="flex h-14 items-center gap-3 border border-ink/25 bg-surface px-4 focus-within:border-ink">
            <IconSearch className="text-ink-dim" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a product — try “barca” or “retro”"
              className="h-full flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-dim/70"
            />
            {query && (
              <IconButton label="Clear the search" className="-mr-3" onClick={() => setQuery("")}>
                <IconClose />
              </IconButton>
            )}
          </label>
          <div className="scrollbar-hidden -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {FILTERS.map((f) => {
              const count = live.filter(f.test).length;
              if (!count && f.id !== "all" && f.id !== filter) return null;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 border px-4 text-[15px] font-medium transition-colors",
                    filter === f.id
                      ? "border-ink bg-ink text-ground"
                      : "border-ink/25 text-ink hover:border-ink",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular-nums", filter === f.id ? "text-ground/70" : "text-ink-dim")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {shown.length ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {shown.map((p) => (
              <li key={p.handle}>
                <Card product={p} onOpen={() => setOpen(p.handle)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-[20px] font-medium text-ink">Nothing here.</p>
            <p className="mt-2 text-[16px] text-ink-dim">
              {query ? `No product matches “${query}”.` : "No products in this group yet."}
            </p>
            {(query || filter !== "all") && (
              <Button
                className="mt-6"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show everything
              </Button>
            )}
          </div>
        )}
      </main>

      {/* On a phone the add button sits where the thumb is. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-ground/95 p-3 backdrop-blur-sm sm:hidden">
        <Button tone="primary" size="lg" className="w-full" onClick={() => setOpen("new")}>
          <IconPlus /> Add a product
        </Button>
      </div>

      {open && (
        <ProductSheet
          key={open}
          product={current ?? null}
          data={data}
          onClose={() => setOpen(null)}
          onSaved={(p, isNew) => {
            upsert(p);
            setOpen(null);
            setToast({
              text: isNew
                ? p.hidden
                  ? `${p.title} is saved, hidden.`
                  : `${p.title} is in the shop.`
                : "Saved. The shop shows it now.",
            });
          }}
          onDeleted={(p) => {
            setData((d) => ({
              ...d,
              products: d.products.map((x) => (x.handle === p.handle ? { ...x, deleted: new Date().toISOString() } : x)),
            }));
            setOpen(null);
            setToast({ text: `${p.title} is deleted.`, action: { label: "Undo", run: () => void restore(p) } });
          }}
          onTeamAdded={(team) => setData((d) => ({ ...d, teams: [...d.teams, team] }))}
        />
      )}

      {room === "deleted" && (
        <Sheet label="Deleted products" width="narrow" onClose={() => setRoom(null)}>
          <RoomHeader title="Deleted products" onClose={() => setRoom(null)} />
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6" data-lenis-prevent>
            {deleted.length ? (
              <ul className="divide-y divide-ink/10">
                {deleted.map((p) => (
                  <DeletedRow key={p.handle} product={p} onRestore={() => restore(p)} />
                ))}
              </ul>
            ) : (
              <p className="pt-10 text-center text-[17px] text-ink-dim">Nothing deleted. Everything is in the shop.</p>
            )}
          </div>
        </Sheet>
      )}

      {room === "settings" && (
        <PrintingRoom
          printing={data.printing}
          onClose={() => setRoom(null)}
          onSaved={(printing) => {
            setData((d) => ({ ...d, printing }));
            setRoom(null);
            setToast({ text: `Printing is now ${money(printing)}.` });
          }}
        />
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function RoomHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-hairline pr-3 pl-1 sm:pl-2">
      <IconButton label="Close" onClick={onClose}>
        <IconClose className="h-6 w-6" />
      </IconButton>
      <h2 className="text-[18px] font-medium text-ink">{title}</h2>
    </header>
  );
}

function Thumb({ product, className }: { product: AdminProduct; className?: string }) {
  const front = product.photos.find((p) => p.role === "front") ?? product.photos[0];
  return (
    <span className={cn("relative block aspect-[3/4] overflow-hidden bg-panel", className)}>
      {front ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={front.preview}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          style={front.blur ? { backgroundImage: `url(${front.blur})`, backgroundSize: "cover" } : undefined}
        />
      ) : (
        <span className="flex h-full items-end p-3 text-[clamp(14px,2.4vw,20px)] leading-[0.95] font-black tracking-[-0.03em] text-ink/70 uppercase">
          {product.title}
        </span>
      )}
    </span>
  );
}

function Card({ product: p, onOpen }: { product: AdminProduct; onOpen: () => void }) {
  const left = stockLeft(p);
  const out = soldOut(p);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={[p.title, priceLine(p), p.hidden && "hidden", out ? "sold out" : left !== null && `${left} left`]
        .filter(Boolean)
        .join(", ")}
      className="group block w-full text-left"
    >
      <span className="relative block">
        <Thumb product={p} className={cn("transition-[opacity,filter] duration-200", (p.hidden || out) && "opacity-55 saturate-50")} />
        <span className="pointer-events-none absolute inset-0 border-2 border-transparent transition-colors group-hover:border-ink" />
        {p.hidden && (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 bg-ground px-2 py-1 text-[12px] font-medium uppercase tracking-[0.05em] text-ink">
            <IconEyeOff className="h-4 w-4" /> Hidden
          </span>
        )}
        {out && !p.hidden && (
          <span className="absolute top-2 left-2 bg-ink px-2 py-1 text-[12px] font-medium uppercase tracking-[0.05em] text-ground">
            Sold out
          </span>
        )}
      </span>
      <span className="mt-2.5 block text-[15px] leading-tight font-medium text-ink">{p.title}</span>
      <span className="mt-1 flex items-baseline justify-between gap-2 text-[14px]">
        <span className="text-ink-mid tabular-nums">{priceLine(p)}</span>
        {left !== null && !out && (
          <span className={cn("tabular-nums", left <= 3 ? "font-medium text-ink" : "text-ink-dim")}>{left} left</span>
        )}
      </span>
    </button>
  );
}

function DeletedRow({ product, onRestore }: { product: AdminProduct; onRestore: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-center gap-4 py-3">
      <Thumb product={product} className="w-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-medium text-ink">{product.title}</p>
        <p className="text-[14px] text-ink-dim">
          Deleted {product.deleted ? new Date(product.deleted).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}
        </p>
      </div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onRestore();
          setBusy(false);
        }}
      >
        {busy && <Spinner />} Bring back
      </Button>
    </li>
  );
}

function PrintingRoom({
  printing,
  onClose,
  onSaved,
}: {
  printing: number;
  onClose: () => void;
  onSaved: (cents: number) => void;
}) {
  const [cents, setCents] = useState(printing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet label="Printing price" width="narrow" onClose={onClose}>
      <RoomHeader title="Printing price" onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6" data-lenis-prevent>
        <Label>Name & number printing</Label>
        <PriceInput label="Printing price" cents={Math.max(100, cents)} onChange={setCents} />
        <p className="mt-4 text-[16px] leading-snug text-ink-dim">
          Added to every shirt, long sleeve and tracksuit someone has printed. Retro shirts include it.
        </p>
        {error && <p className="mt-4 text-[16px] font-medium text-ink">{error}</p>}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-hairline px-4 py-3 sm:px-6">
        <Button tone="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button
          tone="primary"
          size="lg"
          disabled={saving || cents === printing}
          onClick={async () => {
            setSaving(true);
            const res = await savePrintingAction(cents).catch(() => null);
            setSaving(false);
            if (res?.ok) onSaved(res.printing);
            else setError(res?.error ?? "Couldn't save. Try again.");
          }}
        >
          {saving && <Spinner />} Save
        </Button>
      </footer>
    </Sheet>
  );
}
