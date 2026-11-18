"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Phones only: once the real Add to cart row has scrolled out of view, the
 * same action rides along the bottom of the screen — price, chosen size,
 * one button. It isn't there when the page opens, so the first screen is
 * unchanged; it slides in on the first scroll and leaves when the real
 * button is back in view. Sits under the cart drawer (z-30 vs z-40).
 */
export function StickyAdd({
  anchor,
  title,
  price,
  size,
  label,
  disabled,
  onAdd,
}: {
  /** The row holding the real Add to cart button. */
  anchor: React.RefObject<HTMLElement | null>;
  title: string;
  price: string;
  size?: string;
  label: string;
  disabled: boolean;
  onAdd: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    let visible = true;
    const sync = () => setShown(!visible && window.scrollY > 80);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", sync);
    };
  }, [anchor]);

  return (
    <div
      aria-hidden={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-hairline bg-ground/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden",
        "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="t-title truncate">{title}</p>
        <p className="t-meta mt-0.5 tabular-nums text-ink-dim">
          {price}
          {size ? ` · ${size}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        tabIndex={shown ? 0 : -1}
        className="t-label h-11 shrink-0 bg-ink px-5 text-ground transition-opacity duration-150 hover:opacity-85 disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}
