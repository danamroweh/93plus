"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import type { Product } from "@/lib/commerce/types";
import { readSize, saveSize } from "@/lib/size-memory";
import { cn } from "@/lib/utils";

/**
 * The + on a product image — add without opening the product page.
 *
 * Something with no options (mug, keychain) goes straight in. A shirt needs
 * a size, so the + opens a size row over the bottom of the image and the
 * tap on a size is the add. Version defaults to Fan and printing to Blank —
 * anything more considered than that belongs on the product page. A shirt
 * with a preset (Ronaldo 7) adds with the preset printed, because that's
 * what the product is.
 *
 * Sits outside the card's link, so it's a real button rather than a button
 * nested in an anchor.
 */
export function QuickAdd({ product }: { product: Product }) {
  const { add, isBusy } = useCart();
  const [open, setOpen] = useState(false);
  // The size taken last time, outlined so it's one tap without being the only tap.
  const [usual, setUsual] = useState<string | null>(null);

  const sizeOption = product.options.find((o) => o.name === "Size");
  const preset = product.customisable ? product.preset : undefined;
  const custom = preset ? "Name + Number" : "Blank";

  /** The variant a quick add means for a given size. */
  const variantFor = (size?: string) =>
    product.variants.find(
      (v) =>
        (!size || v.options.Size === size) &&
        (!v.options.Version || v.options.Version === "Fan") &&
        (!v.options.Customisation || v.options.Customisation === custom),
    );

  function addSize(size?: string) {
    const variant = variantFor(size);
    if (!variant?.available) return;
    if (size) saveSize(size);
    // Optimistic: the drawer opens with the shirt in it at once; the server
    // confirms behind it (CartProvider rolls back if it can't).
    void add(variant.id, 1, preset ?? {}, { product, variant });
    setOpen(false);
  }

  if (!product.available || !product.variants.some((v) => v.available))
    return null;

  // No options → straight in. Options but no Size → the PDP's job.
  const simple = product.options.length === 0;
  if (!simple && !sizeOption) return null;
  const busy = isBusy;

  return (
    <>
      {open && sizeOption && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-ground/95 p-3 backdrop-blur-sm">
          <p className="t-meta mb-2 text-ink-dim">
            Fan{preset ? ` · ${preset.name} ${preset.number}` : ""} · pick a
            size
          </p>
          {/* 3 across on a phone-width card — XL and XXL take row two and
              the × sits in the empty third slot. One row once there's room. */}
          <div className="grid grid-cols-3 gap-1.5 @min-[260px]:grid-cols-5 @min-[260px]:pr-11">
            {sizeOption.values.map((size) => {
              const available = Boolean(variantFor(size)?.available);
              return (
                <button
                  key={size}
                  type="button"
                  disabled={!available || busy}
                  onClick={() => addSize(size)}
                  className={cn(
                    "t-label h-9 border border-hairline px-1 transition-colors duration-150",
                    "hover:border-ink hover:bg-ink hover:text-ground disabled:cursor-not-allowed",
                    !available && "line-through opacity-35",
                    size === usual && available && "border-ink",
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={
          simple
            ? `Add ${product.title} to cart`
            : open
              ? "Close sizes"
              : `Choose a size for ${product.title}`
        }
        aria-expanded={simple ? undefined : open}
        disabled={busy}
        onClick={() => {
          if (simple) addSize();
          else {
            setUsual(readSize());
            setOpen((o) => !o);
          }
        }}
        className={cn(
          "pointer-events-auto absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center",
          "border border-hairline bg-ground/90 text-ink backdrop-blur-sm",
          "transition-[background-color,color,transform] duration-200 hover:bg-ink hover:text-ground active:scale-90",
          open && "bg-ink text-ground",
          busy && "opacity-60",
        )}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-45",
          )}
        >
          <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      </button>
    </>
  );
}
