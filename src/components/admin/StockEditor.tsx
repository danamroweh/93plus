"use client";

import type { Kit } from "@/lib/commerce/catalogue";
import { SIZES, VERSIONS, hasVersions, stockKeysFor, type Stock } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Label, Segmented, Stepper } from "./parts";

/**
 * Two ways to run stock, one switch between them:
 *
 *   Always available — the shop never runs out; tap a size to mark it
 *   sold out by hand. Right for shirts ordered in when someone buys.
 *   Count stock — type how many you have; every order takes from it and
 *   a size at 0 shows as sold out by itself.
 */
export function StockEditor({
  stock,
  onChange,
  kind,
  kit,
}: {
  stock: Stock;
  onChange: (s: Stock) => void;
  kind: "shirt" | "printable";
  kit: Kit | null;
}) {
  const keys = stockKeysFor(kind, kit);
  const versions = kind === "shirt" && hasVersions(kit) ? VERSIONS : [null];
  const key = (v: string | null, size: string) => (v ? `${v}/${size}` : size);

  const total = stock.track ? keys.reduce((n, k) => n + ((stock.track && stock.qty[k]) || 0), 0) : null;
  const offCount = !stock.track ? keys.filter((k) => !stock.track && stock.off?.includes(k)).length : 0;

  const summary =
    total !== null
      ? total === 0
        ? "None left — shows as sold out"
        : `${total} in stock`
      : offCount === keys.length
        ? "Sold out"
        : offCount
          ? `${offCount} ${kind === "printable" ? "" : offCount === 1 ? "size " : "sizes "}sold out`
          : "Never runs out";

  const setMode = (mode: "always" | "count") => {
    if (mode === "count" && !stock.track)
      onChange({ track: true, qty: Object.fromEntries(keys.map((k) => [k, 0])) });
    if (mode === "always" && stock.track) onChange({ track: false });
  };

  const toggle = (k: string) => {
    if (stock.track) return;
    const off = new Set(stock.off ?? []);
    if (off.has(k)) off.delete(k);
    else off.add(k);
    onChange({ track: false, off: keys.filter((x) => off.has(x)) });
  };

  const setQty = (k: string, n: number) => {
    if (!stock.track) return;
    onChange({ track: true, qty: { ...stock.qty, [k]: n } });
  };

  return (
    <section>
      <Label aside={<span className={cn(total === 0 && "font-medium text-ink")}>{summary}</span>}>Stock</Label>
      <Segmented
        label="How stock works"
        value={stock.track ? "count" : "always"}
        onChange={setMode}
        options={[
          { value: "always", label: "Always available" },
          { value: "count", label: "Count stock" },
        ]}
      />

      {kind === "printable" ? (
        <div className="mt-4">
          {stock.track ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-[16px] text-ink">How many you have</span>
              <Stepper label="How many you have" value={stock.qty.one ?? 0} onChange={(n) => setQty("one", n)} />
            </div>
          ) : (
            <SizeChip label="In stock" off={Boolean(stock.off?.includes("one"))} onClick={() => toggle("one")} wide />
          )}
        </div>
      ) : stock.track ? (
        <div className="mt-4">
          {versions[0] && (
            <div className="mb-1 grid grid-cols-[2.25rem_1fr_1fr] gap-2 sm:grid-cols-[3rem_1fr_1fr] sm:gap-3 text-[13px] font-medium uppercase tracking-[0.06em] text-ink-dim">
              <span />
              {versions.map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
          )}
          <div className="divide-y divide-ink/10">
            {SIZES.map((size) => (
              <div
                key={size}
                className={cn(
                  "grid items-center gap-3 py-2",
                  versions[0]
                    ? "grid-cols-[2.25rem_1fr_1fr] gap-2 sm:grid-cols-[3rem_1fr_1fr] sm:gap-3"
                    : "grid-cols-[3rem_auto] justify-between",
                )}
              >
                <span className="text-[18px] font-medium text-ink">{size}</span>
                {versions.map((v) => (
                  <Stepper
                    key={v ?? "one"}
                    label={`${v ? `${v} ` : ""}${size}`}
                    value={stock.qty[key(v, size)] ?? 0}
                    onChange={(n) => setQty(key(v, size), n)}
                    compact={Boolean(versions[0])}
                    className={versions[0] ? "w-full max-w-[170px]" : ""}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {versions.map((v) => (
            <div key={v ?? "one"}>
              {v && <div className="mb-1.5 text-[13px] font-medium uppercase tracking-[0.06em] text-ink-dim">{v}</div>}
              <div className="grid grid-cols-5 gap-2">
                {SIZES.map((size) => (
                  <SizeChip
                    key={size}
                    label={size}
                    off={Boolean(stock.off?.includes(key(v, size)))}
                    onClick={() => toggle(key(v, size))}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="text-[14px] text-ink-dim">Tap a size to mark it sold out. Tap again to bring it back.</p>
        </div>
      )}
    </section>
  );
}

function SizeChip({ label, off, onClick, wide }: { label: string; off: boolean; onClick: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={!off}
      onClick={onClick}
      className={cn(
        "flex h-14 flex-col items-center justify-center border text-[17px] font-medium transition-colors",
        wide && "w-full flex-row gap-3",
        off
          ? "border-ink/15 bg-panel/60 text-ink-dim"
          : "border-ink/40 bg-surface text-ink hover:border-ink",
      )}
    >
      <span className={cn(off && "line-through")}>{wide && off ? "Sold out" : label}</span>
      {off && !wide && <span className="text-[10px] font-medium uppercase tracking-[0.06em]">Sold out</span>}
      {wide && !off && <span className="text-[13px] font-normal text-ink-dim">— tap if it sells out</span>}
    </button>
  );
}
