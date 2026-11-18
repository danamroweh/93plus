"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductPhoto } from "./ProductPhoto";
import { ShirtPreview } from "./ShirtPreview";
import { StickyAdd } from "./StickyAdd";
import { PerksList } from "./Perks";
import { readSize, saveSize } from "@/lib/size-memory";
import { BackLink, ChipLink, QtyStepper } from "@/components/ui/Buttons";
import { Sparkle } from "@/components/ui/Logo";
import { useCart } from "@/components/cart/CartProvider";
import { backOf, type Product } from "@/lib/commerce/types";
import { cn, formatPrice } from "@/lib/utils";

const NAME_MAX = 12;

/**
 * 16px type, not the 13px label size: iOS zooms the page into any field set
 * smaller than that on focus, and doesn't zoom back out when you're done.
 */
const FIELD =
  "w-full border border-hairline bg-transparent px-4 py-3 text-base font-medium uppercase tracking-[0.04em] placeholder:text-ink-dim focus:border-ink focus:outline-none";

/** What the extra $12 buys — answered where the choice is made. */
const VERSION_NOTES: Record<string, string> = {
  Fan: "Regular fit, soft knit, embroidered badge. Built for the stands.",
  Player:
    "Slim athletic fit, lightweight breathable fabric, heat-pressed badge. Cut like the one on the pitch — between sizes, go one up.",
};

export function ProductView({ product }: { product: Product }) {
  const { add, isBusy } = useCart();

  // Options are rendered from whatever the product actually has, so a shirt
  // with three and a keyring with none go through the same component. That's
  // what stops accessories needing their own template.
  // Open on a variant that can actually be bought. Defaulting to the first
  // value of every option lands on a sold-out size whenever the smallest is
  // gone — and since sold-out sizes are disabled, the page opens reading
  // "Sold out" with no way to click out of it.
  // A preset (Ronaldo 7 on the retros) opens already customised.
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const preset: Record<string, string> = product.preset
      ? { Customisation: "Name + Number" }
      : {};
    const firstBuyable = product.variants.find(
      (v) => v.available && (!product.preset || v.options.Customisation === "Name + Number"),
    );
    if (firstBuyable && product.options.length)
      return Object.fromEntries(
        product.options.map((o) => [o.name, firstBuyable.options[o.name]]),
      );
    return {
      ...Object.fromEntries(product.options.map((o) => [o.name, o.values[0]])),
      ...preset,
    };
  });
  const [name, setName] = useState(product.preset?.name ?? "");
  const [number, setNumber] = useState(product.preset?.number ?? "");
  const [quantity, setQuantity] = useState(1);
  // The size taken last time, if this shirt comes in it — one tap fewer on a
  // phone. Read after mount: there's no localStorage on the server.
  const [usual, setUsual] = useState<string | null>(null);
  const addRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const size = readSize();
    if (
      !size ||
      !product.variants.some((v) => v.options.Size === size && v.available)
    )
      return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((s) => ({ ...s, Size: size }));
    setUsual(size);
  }, [product.variants]);

  const variant = useMemo(
    () =>
      product.variants.find((v) =>
        Object.entries(selected).every(([k, val]) => v.options[k] === val),
      ) ?? product.variants[0],
    [product.variants, selected],
  );

  const isCustomising =
    product.customisable && selected.Customisation === "Name + Number";
  const showPreview = isCustomising && Boolean(name || number);
  // Every frame in shoot order except the hot one — that colour belongs to
  // the card's hover and nowhere else. The preview prints on the real back.
  const [front, ...gallery] = product.images.filter((i) => i.role !== "hover");
  const back = backOf(product.images);

  const canAdd = Boolean(variant?.available) && product.available;
  // "Sold out" belongs to the product. A single unavailable combination is a
  // different message — the shirt exists, this configuration doesn't.
  const productSoldOut =
    !product.available || !product.variants.some((v) => v.available);

  function handleAdd() {
    if (!variant || !canAdd) return;
    if (selected.Size) saveSize(selected.Size);
    // Optimistic: the drawer opens with the shirt in it at once; the server
    // confirms behind it.
    void add(
      variant.id,
      quantity,
      isCustomising ? { name: name || undefined, number: number || undefined } : {},
      { product, variant },
    );
  }

  /** Sizes that don't exist for the current Version stay visible but struck. */
  function isValueAvailable(optionName: string, value: string) {
    return product.variants.some(
      (v) =>
        v.options[optionName] === value &&
        Object.entries(selected).every(
          ([k, val]) => k === optionName || v.options[k] === val,
        ) &&
        v.available,
    );
  }

  return (
    <div className="grid gap-6 px-4 pt-24 pb-32 lg:grid-cols-16 lg:px-6 lg:pt-28">
      {/* gallery — vertical stack on desktop, 85vw carousel on mobile */}
      <div className="min-w-0 lg:col-span-8">
        <div className="scrollbar-hidden -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-6 lg:overflow-visible lg:px-0">
          {showPreview && back ? (
            <ShirtPreview
              back={back}
              name={name}
              number={number}
              print={product.print}
              className="aspect-shirt w-[85vw] shrink-0 snap-start lg:w-full"
            />
          ) : (
            <div
              // The card's photo morphs into this one on browsers that can
              // (PhotoLink); the name is set in globals.css.
              data-hero-photo
              className="relative aspect-shirt w-[85vw] shrink-0 snap-start overflow-hidden bg-panel lg:w-full"
            >
              <ProductPhoto
                image={front}
                alt={product.title}
                caption={product.category}
                preload
                fetchPriority="high"
                sizes="(min-width: 1024px) 60vw, 85vw"
                className="object-cover"
              />
            </div>
          )}

          {gallery.map((image, i) => (
            <div
              key={i}
              className="relative aspect-shirt w-[85vw] shrink-0 snap-start overflow-hidden bg-panel lg:w-full"
            >
              <ProductPhoto
                image={image}
                caption={product.category}
                sizes="(min-width: 1024px) 60vw, 85vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* buy panel */}
      <div className="min-w-0 lg:col-span-8">
        <div className="lg:sticky lg:top-28">
          <BackLink className="mb-6" />

          <h1 className="t-display mb-4 text-[clamp(2rem,7vw,4.5rem)] break-words hyphens-auto">
            {product.title}
          </h1>

          <p className="t-statement mb-5 text-3xl tabular-nums">
            {variant
              ? formatPrice(variant.price.cents, variant.price.currency)
              : "—"}
          </p>

          {/* The question people asked most — answered before they ask. */}
          {product.set && (
            <p className="t-label mb-6 inline-flex items-center gap-2.5 border border-ink px-3.5 py-2.5">
              <Sparkle className="h-3 w-3 shrink-0" />
              Full set: {product.set.toLowerCase()} included
            </p>
          )}

          <p className="t-body mb-8 max-w-[46ch] text-ink-mid">
            {product.description}
          </p>

          {product.options.map((option) => (
            <fieldset key={option.name} className="mb-6">
              <legend className="t-meta mb-3 text-ink-dim">
                {option.name}
              </legend>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const active = selected[option.name] === value;
                  const available = isValueAvailable(option.name, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      // Version is the identity choice and always stays live;
                      // Size is the constraint that can run out.
                      disabled={!available && option.name === "Size"}
                      aria-disabled={!available}
                      onClick={() =>
                        setSelected((s) => ({ ...s, [option.name]: value }))
                      }
                      className={cn(
                        "t-label min-w-14 border px-4 py-3 transition-colors duration-150",
                        active
                          ? "border-ink bg-ink text-ground"
                          : "border-hairline text-ink hover:border-ink",
                        // A gone size stays visible — people need to know it
                        // exists so they come back for the restock.
                        !available && "line-through opacity-35",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              {option.name === "Size" && usual && selected.Size === usual && (
                <p className="t-meta mt-3 normal-case text-ink-mid">Your usual size.</p>
              )}
              {option.name === "Version" && VERSION_NOTES[selected.Version] && (
                <p className="t-meta mt-3 max-w-[46ch] normal-case text-ink-mid">
                  {VERSION_NOTES[selected.Version]}
                </p>
              )}
            </fieldset>
          ))}

          {isCustomising && (
            <div className="mb-8 border-t border-hairline pt-6">
              {/* One shirt, several famous backs (PSG 22/23): a tap fills the
                  fields, which stay editable for anyone else's name. */}
              {product.presets && product.presets.length > 1 && (
                <fieldset className="mb-6">
                  <legend className="t-meta mb-3 text-ink-dim">Player</legend>
                  <div className="flex flex-wrap gap-2">
                    {product.presets.map((p) => {
                      const active = name === p.name && number === p.number;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setName(p.name);
                            setNumber(p.number);
                          }}
                          className={cn(
                            "t-label border px-4 py-3 transition-colors duration-150",
                            active
                              ? "border-ink bg-ink text-ground"
                              : "border-hairline text-ink hover:border-ink",
                          )}
                        >
                          {p.name} {p.number}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <div className="flex gap-4">
                <label className="flex-1">
                  <span className="t-meta mb-2 block text-ink-dim">Name</span>
                  <input
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(e) =>
                      setName(
                        e.target.value.toUpperCase().replace(/[^A-Z .'-]/g, ""),
                      )
                    }
                    placeholder="MARTINEZ"
                    className={FIELD}
                  />
                  <span className="t-meta mt-1.5 block text-ink-dim">
                    {name.length}/{NAME_MAX}
                  </span>
                </label>
                <label className="w-28">
                  <span className="t-meta mb-2 block text-ink-dim">Number</span>
                  <input
                    value={number}
                    inputMode="numeric"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setNumber(v === "0" ? "" : v);
                    }}
                    placeholder="10"
                    className={cn(FIELD, "tabular-nums")}
                  />
                </label>
              </div>

              {/* Stated where the decision is made, not buried in a policy
                  page — personalised items can't be resold, and this is what
                  prevents the dispute. */}
              <p className="t-meta mt-4 [color:var(--g-1)]">
                Customised shirts can&rsquo;t be returned.
              </p>
            </div>
          )}

          <div ref={addRow} className="flex items-center gap-3">
            <QtyStepper value={quantity} onChange={setQuantity} />

            {productSoldOut ? (
              <span
                className="t-statement flex-1 text-3xl line-through decoration-2"
                aria-label="Out of stock"
              >
                Sold out
              </span>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isBusy || !canAdd}
                className="t-label h-[50px] flex-1 border border-ink bg-ink px-6 text-ground transition-opacity duration-150 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBusy
                  ? "Adding…"
                  : canAdd
                    ? "Add to cart"
                    : "Unavailable in this size"}
              </button>
            )}
          </div>

          {!productSoldOut && (
            <StickyAdd
              anchor={addRow}
              title={product.title}
              price={variant ? formatPrice(variant.price.cents, variant.price.currency) : "—"}
              size={selected.Size}
              label={canAdd ? "Add to cart" : "Unavailable"}
              disabled={!canAdd}
              onAdd={handleAdd}
            />
          )}

          <div className="mt-6">
            <PerksList hideSet />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <ChipLink href="/size-guide">Size guide</ChipLink>
            <ChipLink href="/shipping">Delivery</ChipLink>
            <ChipLink href="/returns">Returns</ChipLink>
          </div>
        </div>
      </div>
    </div>
  );
}
