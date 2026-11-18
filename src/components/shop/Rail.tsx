"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal rail: arrows on desktop, native scroll on touch.
 *
 * Three things were making this glitch, all now removed:
 *
 * 1. `data-lenis-prevent` told Lenis to ignore the element entirely — but
 *    that covers *vertical* wheel too, so moving the pointer over a rail
 *    handed page scrolling back to the browser mid-gesture. Lenis smooth on
 *    one part of the page, native jump on another, fighting each other. That
 *    was the judder. Lenis already ignores horizontal-dominant gestures, so
 *    trackpad panning still works without it.
 *
 * 2. Pointer-drag fought scroll-snap and needed click suppression to stop
 *    tiles navigating on release. Arrows do the job without any of it.
 *
 * 3. Scroll snap cancelled programmatic scrolls. The arrows now step by a
 *    whole number of tiles, so every stop lands aligned without snap.
 *
 * No `touch-action` either. `pan-x` looked tidy, but it tells a phone the
 * rail only scrolls sideways, so a thumb that lands on a rail and swipes up
 * moved nothing at all. The browser already locks each swipe to the axis it
 * starts on.
 */
export function Rail({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // 2px tolerance — sub-pixel widths never land exactly on the boundary.
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = rail.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const page = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const tile = el.firstElementChild as HTMLElement | null;
    if (!tile) return;

    // Step by whole tiles so every stop lands aligned — no snap needed, and
    // nothing to cancel the scroll halfway.
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = tile.getBoundingClientRect().width + gap;
    const perPage = Math.max(1, Math.floor(el.clientWidth / step) - 1);

    el.scrollBy({ left: direction * step * perPage, behavior: "smooth" });
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between border-t border-hairline pt-4">
        <h2 className="t-meta text-ink-dim">{label}</h2>

        <div className="flex items-center gap-4">
          {aside && <span className="t-meta text-ink-dim">{aside}</span>}
          <div className="hidden items-center gap-1 md:flex">
            <RailButton
              direction="left"
              disabled={atStart}
              onClick={() => page(-1)}
            />
            <RailButton
              direction="right"
              disabled={atEnd}
              onClick={() => page(1)}
            />
          </div>
        </div>
      </div>

      <div
        ref={rail}
        onScroll={sync}
        className="scrollbar-hidden -mr-4 flex gap-3 overflow-x-auto overscroll-x-contain pb-1 lg:-mr-6 lg:gap-4"
      >
        {children}
        {/* keeps the last tile clear of the viewport edge */}
        <div aria-hidden className="w-1 shrink-0 lg:w-2" />
      </div>
    </>
  );
}

function RailButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "flex h-8 w-8 items-center justify-center transition-opacity duration-150",
        disabled
          ? "cursor-default opacity-20"
          : "text-ink-dim opacity-100 hover:text-ink",
      )}
    >
      <svg
        width="15"
        height="10"
        viewBox="0 0 15 10"
        fill="none"
        aria-hidden
        className={direction === "left" ? "rotate-180" : undefined}
      >
        <path
          d="M9.5.7 13.8 5 9.5 9.3M13.4 5H0"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </button>
  );
}
