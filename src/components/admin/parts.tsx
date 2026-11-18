"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The shop editor's building blocks. Same ground, ink and square corners as
 * the shop, at a size a thumb can't miss: every control is at least 48px,
 * every input 16px+ (no zoom on iPhone).
 */

// ── icons ─────────────────────────────────────────────────────────────

type IconProps = { className?: string };
const icon = (d: React.ReactNode) =>
  function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn("h-5 w-5 shrink-0", className)}
      >
        {d}
      </svg>
    );
  };

export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconMinus = icon(<path d="M5 12h14" />);
export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </>,
);
export const IconClose = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const IconEye = icon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconEyeOff = icon(
  <>
    <path d="M4 4l16 16M9.9 5.8A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.6M6.4 7.6C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
    <path d="M9.9 10a3 3 0 0 0 4.1 4.2" />
  </>,
);
export const IconTrash = icon(
  <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10.2 11v5M13.8 11v5" />,
);
export const IconCamera = icon(
  <>
    <path d="M3.5 8.5h3.2L8.5 6h7l1.8 2.5h3.2v10h-17z" />
    <circle cx="12" cy="13.2" r="3.4" />
  </>,
);
export const IconMore = icon(
  <>
    <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
  </>,
);
export const IconCheck = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconOut = icon(<path d="M9 5H5v14h14v-4M13 5h6v6M19 5l-8.5 8.5" />);
export const IconBack = icon(<path d="M15 5l-7 7 7 7" />);
export const IconAlert = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.2v.3" />
  </>,
);
export const IconShirt = icon(
  <path d="M8.5 3.5 3 6.5l2 4.5 2.5-1v10.5h9V10l2.5 1 2-4.5-5.5-3c-.5 1.6-2 2.6-3.5 2.6s-3-1-3.5-2.6Z" />,
);
export const IconRetro = icon(
  <>
    <path d="M8.5 3.5 3 6.5l2 4.5 2.5-1v10.5h9V10l2.5 1 2-4.5-5.5-3c-.5 1.6-2 2.6-3.5 2.6s-3-1-3.5-2.6Z" />
    <path d="M7.5 14h9" />
  </>,
);
export const IconLongSleeve = icon(
  <path d="M8.5 3.5 4.5 6 2.5 19l2.5.6 2.5-9.6v10.5h9V10l2.5 9.6 2.5-.6L19.5 6l-4-2.5c-.5 1.6-2 2.6-3.5 2.6s-3-1-3.5-2.6Z" />,
);
export const IconTracksuit = icon(
  <>
    <path d="M8.5 3.5 4.5 6 3 13.5l2.4.6L7.5 9v5h9V9l2.1 5.1 2.4-.6L19.5 6l-4-2.5-3.5 2-3.5-2Z" />
    <path d="M12 5.5V14M8.5 14l-.5 7h3l1-5 1 5h3l-.5-7" />
  </>,
);
export const IconKeychain = icon(
  <>
    <circle cx="8" cy="7" r="3.5" />
    <path d="M10.5 9.5 13 12M12 12.5h5.5l2 2.5-2 5.5h-6l-1.5-4.5z" />
  </>,
);
export const IconMug = icon(
  <path d="M5 7.5h10.5v9a3 3 0 0 1-3 3h-4.5a3 3 0 0 1-3-3zM15.5 9.5h1.7a2.3 2.3 0 0 1 0 4.6h-1.7M7.5 3.5v1.5M10.3 3v2M13 3.5v1.5" />,
);
export const IconPillow = icon(
  <path d="M4.5 6.5c2.5 1 12.5 1 15 0 1.3 3.7 1.3 7.3 0 11-2.5-1-12.5-1-15 0-1.3-3.7-1.3-7.3 0-11Z" />,
);

// ── buttons ───────────────────────────────────────────────────────────

type ButtonProps = React.ComponentProps<"button"> & {
  tone?: "primary" | "quiet" | "outline" | "danger";
  size?: "md" | "lg";
};

export function Button({ tone = "outline", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium uppercase tracking-[0.04em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        size === "lg" ? "h-14 px-6 text-[15px]" : "h-12 px-4 text-[14px]",
        tone === "primary" && "bg-ink text-ground hover:bg-[#7d0f04] active:bg-[#6a0d03]",
        tone === "outline" && "border border-ink/35 text-ink hover:border-ink hover:bg-ink hover:text-ground",
        tone === "quiet" && "text-ink-dim hover:bg-ink/[0.06] hover:text-ink",
        tone === "danger" && "bg-[#b3261e] text-white hover:bg-[#93201a]",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center text-ink transition-colors hover:bg-ink/[0.07] active:bg-ink/[0.12]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── inputs ────────────────────────────────────────────────────────────

export function Label({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-ink-dim">{children}</h3>
      {aside && <div className="text-[14px] text-ink-dim">{aside}</div>}
    </div>
  );
}

export const inputClass =
  "h-14 w-full border border-ink/25 bg-surface px-4 text-[17px] text-ink outline-none transition-colors placeholder:text-ink-dim/60 focus:border-ink";

/** − value + — the whole stepper is thumb-sized; the number can also be typed. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  label,
  className,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
  /** Two side by side on a phone. */
  compact?: boolean;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const side = compact ? "w-10 sm:w-12" : "w-12";
  return (
    <div className={cn("inline-flex h-12 items-stretch border border-ink/25 bg-surface", className)}>
      <button
        type="button"
        aria-label={`Fewer — ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={cn(side, "flex items-center justify-center text-ink hover:bg-ink/[0.06] active:bg-ink/[0.12] disabled:opacity-25")}
      >
        <IconMinus />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={typed ?? String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
          setTyped(raw);
          if (raw !== "") onChange(clamp(Number(raw)));
        }}
        onBlur={() => setTyped(null)}
        className={cn(
          "min-w-0 border-x border-ink/15 bg-transparent text-center text-[18px] font-medium tabular-nums outline-none focus:bg-ink/[0.04]",
          compact ? "w-11 flex-1 sm:w-14" : "w-14",
          value === 0 ? "text-ink-dim" : "text-ink",
        )}
      />
      <button
        type="button"
        aria-label={`More — ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={cn(side, "flex items-center justify-center text-ink hover:bg-ink/[0.06] active:bg-ink/[0.12] disabled:opacity-25")}
      >
        <IconPlus />
      </button>
    </div>
  );
}

const dollars = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

/** A price in dollars, kept as cents. − and + move a whole dollar. */
export function PriceInput({
  cents,
  onChange,
  label,
}: {
  cents: number;
  onChange: (cents: number) => void;
  label: string;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <div className="inline-flex h-14 items-stretch border border-ink/25 bg-surface">
      <button
        type="button"
        aria-label={`Lower — ${label}`}
        disabled={cents <= 100}
        onClick={() => onChange(Math.max(100, Math.round(cents / 100) * 100 - 100))}
        className="flex w-14 items-center justify-center text-ink hover:bg-ink/[0.06] active:bg-ink/[0.12] disabled:opacity-25"
      >
        <IconMinus />
      </button>
      <label className="flex items-center border-x border-ink/15 px-3 focus-within:bg-ink/[0.04]">
        <span className="text-[22px] font-medium text-ink-dim">$</span>
        <input
          inputMode="decimal"
          aria-label={label}
          value={typed ?? dollars(cents)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, "").slice(0, 7);
            setTyped(raw);
            const n = Math.round(Number(raw) * 100);
            if (raw !== "" && Number.isFinite(n) && n > 0) onChange(Math.min(100_000, n));
          }}
          onBlur={() => setTyped(null)}
          className="w-16 bg-transparent pl-1 text-[24px] font-medium tabular-nums text-ink outline-none"
        />
      </label>
      <button
        type="button"
        aria-label={`Higher — ${label}`}
        onClick={() => onChange(Math.min(100_000, Math.round(cents / 100) * 100 + 100))}
        className="flex w-14 items-center justify-center text-ink hover:bg-ink/[0.06] active:bg-ink/[0.12]"
      >
        <IconPlus />
      </button>
    </div>
  );
}

/** The one round thing in the editor: a switch reads as a switch at any age. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-[#1f7a3f]" : "bg-ink/25",
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200",
          checked && "translate-x-6",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col border border-ink/25 bg-surface">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-12 px-3 text-[15px] font-medium transition-colors",
            value === o.value ? "bg-ink text-ground" : "text-ink hover:bg-ink/[0.06]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── layers ────────────────────────────────────────────────────────────

/** Esc and the backdrop close it; the page behind doesn't scroll. */
export function Sheet({
  onClose,
  children,
  label,
  width = "wide",
}: {
  onClose: () => void;
  children: React.ReactNode;
  label: string;
  width?: "wide" | "narrow";
}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    const scroller = document.querySelector<HTMLElement>("[data-admin]");
    const was = scroller?.style.overflow ?? "";
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (scroller) scroller.style.overflow = was;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal aria-label={label}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => close.current()}
        className="admin-fade absolute inset-0 cursor-default bg-[#2b0904]/35"
      />
      <div
        className={cn(
          "admin-slide relative flex h-full w-full flex-col bg-ground shadow-[-20px_0_60px_rgba(43,9,4,0.18)]",
          width === "wide" ? "max-w-[1080px]" : "max-w-[560px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Dialog({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => close.current()}
        className="admin-fade absolute inset-0 cursor-default bg-[#2b0904]/40"
      />
      <div className="admin-pop relative w-full max-w-[440px] bg-surface p-6 shadow-[0_24px_80px_rgba(43,9,4,0.3)]">
        <h2 className="text-[22px] font-medium leading-tight text-ink">{title}</h2>
        {children && <div className="mt-3 text-[16px] leading-snug text-ink-dim">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      </div>
    </div>
  );
}

export type ToastState = { text: string; action?: { label: string; run: () => void } } | null;

export function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => done.current(), toast.action ? 6000 : 3500);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 sm:bottom-8">
      <div
        role="status"
        className="admin-pop pointer-events-auto flex min-h-14 max-w-[520px] items-center gap-4 bg-ink py-2 pr-2 pl-5 text-[16px] text-ground shadow-[0_12px_40px_rgba(43,9,4,0.35)]"
      >
        <IconCheck className="text-ground/80" />
        <span className="flex-1">{toast.text}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.run();
              done.current();
            }}
            className="h-10 px-4 font-medium uppercase tracking-[0.04em] text-ground underline-offset-4 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

/** Secondary actions, behind ⋯. */
export function Menu({
  items,
}: {
  items: { label: string; icon?: React.ReactNode; onClick?: () => void; href?: string; badge?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <IconButton label="More" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconMore className="h-6 w-6" />
      </IconButton>
      {open && (
        <div className="admin-pop absolute top-full right-0 z-30 mt-1 w-64 border border-ink/15 bg-surface py-2 shadow-[0_16px_48px_rgba(43,9,4,0.18)]">
          {items.map((item) => {
            const inner = (
              <>
                <span className="text-ink-dim">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && <span className="text-[14px] text-ink-dim tabular-nums">{item.badge}</span>}
              </>
            );
            const cls = "flex h-12 w-full items-center gap-3 px-4 text-left text-[16px] text-ink hover:bg-ink/[0.06]";
            return item.href ? (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className={cls} onClick={() => setOpen(false)}>
                {inner}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                className={cls}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-5 w-5 animate-spin", className)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export const money = (cents: number) =>
  `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;
