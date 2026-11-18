"use client";

import { ProductPhoto } from "@/components/shop/ProductPhoto";
import { easings } from "@/lib/easing";
import { useEffect, useRef, useState } from "react";
import { Sparkle } from "@/components/ui/Logo";
import { useSite } from "@/components/providers/SiteProvider";
import { useCart } from "./CartProvider";
import { Checkout } from "./Checkout";
import { Confirmation, readLastOrder } from "./Confirmation";
import type { PlacedOrder } from "@/lib/commerce/actions";
import { FREE_SHIPPING_CENTS, backOf } from "@/lib/commerce/types";
import { cn, formatPrice } from "@/lib/utils";
import { DELIVERY } from "@/lib/contact";
import { ChipButton, QtyStepper } from "@/components/ui/Buttons";

/**
 * A drawer, not a route.
 *
 * OUTFIT can afford /bag as a destination because it's a studio flex. This
 * is optimised for purchase, and every navigation away from the product is
 * a chance to lose the sale.
 *
 * Everything here is functional UI, so it runs at 200–250ms. The slow,
 * expensive easings belong to the preloader and the card reveal.
 */
export function CartDrawer() {
  const { cart, loaded, notice, isOpen, close, update, remove, justAdded } = useCart();
  const { lenis } = useSite();
  const panel = useRef<HTMLDivElement>(null);
  const sparkle = useRef<HTMLDivElement>(null);

  const subtotal = cart?.subtotal.cents ?? 0;
  const remaining = Math.max(0, FREE_SHIPPING_CENTS - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_CENTS) * 100);
  // Shopify brings its own hosted checkout. Without it, checkout is the
  // on-site form and the order lands in the Google Sheet.
  const hostedCheckout =
    cart?.checkoutUrl && !cart.checkoutUrl.startsWith("#")
      ? cart.checkoutUrl
      : null;
  const [step, setStep] = useState<"cart" | "checkout" | "receipt">("cart");
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);

  // Closing after an order (or mid-form) always reopens on the cart — which
  // offers the last receipt back, for the Whish/OMT payer who left to pay.
  useEffect(() => {
    if (isOpen) {
      // localStorage only exists in the browser, after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastOrder(readLastOrder());
      return;
    }
    const t = setTimeout(() => setStep("cart"), 250);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Scroll lock + the page behind receding
  useEffect(() => {
    const root = document.documentElement;
    if (isOpen) {
      root.classList.add("has-cart-open");
      lenis?.stop();
    } else {
      root.classList.remove("has-cart-open");
      lenis?.start();
    }
    return () => {
      root.classList.remove("has-cart-open");
    };
  }, [isOpen, lenis]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // The sparkle fires when something lands — the mark shows up at the
  // moment of purchase, not just in the header. Pops in on GSAP's
  // back.out(2) over 0.5 s, fades on power1.out from 0.7 s to 1 s: the same
  // curves, run by the browser (lib/easing.ts).
  useEffect(() => {
    const el = sparkle.current;
    if (!justAdded || !el) return;
    el.getAnimations().forEach((a) => a.cancel());
    const { backOut2, power1Out } = easings();
    el.style.visibility = "visible";
    el.animate(
      [{ transform: "scale(0) rotate(-90deg)" }, { transform: "none" }],
      { duration: 500, easing: backOut2 },
    );
    const fade = el.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.7, easing: power1Out },
        { opacity: 0, offset: 1 },
      ],
      { duration: 1000, fill: "forwards" },
    );
    fade.onfinish = () => {
      el.style.visibility = "hidden";
      fade.cancel();
    };
  }, [justAdded]);

  const lines = cart?.lines ?? [];

  return (
    <>
      <div
        onClick={close}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(20,14,12,0.45)] transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className={cn(
          "fixed top-0 right-0 z-40 flex h-dvh w-full flex-col bg-surface md:w-[440px]",
          "border-l border-hairline transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-5">
          <div className="flex items-center gap-2">
            <h2 className="t-label">Cart ({cart?.totalQuantity ?? 0})</h2>
            <div
              ref={sparkle}
              className="opacity-0"
              style={{ visibility: "hidden" }}
            >
              <Sparkle className="h-3 w-3 [color:var(--g-1)]" />
            </div>
          </div>
          <ChipButton onClick={close} aria-label="Close cart">
            Close
            <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3">
              <path d="m1 1 10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </ChipButton>
        </div>

        {notice && (
          <p role="status" className="t-meta border-b border-hairline px-5 py-3 [color:var(--g-1)]">
            {notice}
          </p>
        )}

        {step === "checkout" ? (
          <Checkout onBack={() => setStep("cart")} onDone={close} />
        ) : step === "receipt" && lastOrder ? (
          <Confirmation order={lastOrder} onDone={close} replay={false} />
        ) : (
          <>
            {lines.length > 0 && (
              <div className="border-b border-hairline px-5 py-4">
                <div className="h-[3px] w-full bg-panel">
                  <div
                    className="gradient-fill h-full transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="t-label mt-2.5">
                  {remaining > 0 ? (
                    <>
                      Add {formatPrice(remaining)} more for{" "}
                      <span className="[color:var(--g-1)]">free delivery</span>
                    </>
                  ) : (
                    <span className="[color:var(--g-1)]">
                      Free delivery unlocked
                    </span>
                  )}
                </p>
                <p className="t-meta mt-1 text-ink-dim">
                  Every order over {formatPrice(FREE_SHIPPING_CENTS)} ships free
                </p>
              </div>
            )}

            {/* data-lenis-prevent: the page's smooth scroll is paused while
                the drawer is open, and paused Lenis swallows every wheel and
                touch move — including the ones meant for this list. */}
            <div className="flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
              {lines.length === 0 && !loaded ? (
                // First open before the cart has come back from the server:
                // shapes where the lines will be, not a flash of "Nothing here yet".
                <ul aria-busy="true" aria-label="Loading cart">
                  {[0, 1].map((i) => (
                    <li key={i} className="flex gap-4 border-b border-hairline px-5 py-5">
                      <div className="skeleton aspect-shirt w-20 shrink-0" />
                      <div className="flex flex-1 flex-col gap-2 pt-1">
                        <div className="skeleton h-4 w-2/3" />
                        <div className="skeleton h-3 w-1/3" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : lines.length === 0 ? (
                <div className="flex h-full flex-col">
                  {lastOrder && (
                    <button
                      type="button"
                      onClick={() => setStep("receipt")}
                      className="gradient-win m-5 flex items-center justify-between gap-4 p-4 text-left text-white"
                    >
                      <div>
                        <p className="t-meta opacity-85">Your last order</p>
                        <p className="t-label mt-1 tabular-nums">
                          {lastOrder.number} · {lastOrder.total}
                        </p>
                        <p className="t-meta mt-1 normal-case opacity-90">
                          Payment and delivery details
                        </p>
                      </div>
                      <Sparkle className="h-6 w-6 shrink-0" />
                    </button>
                  )}
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                    <Sparkle className="h-20 w-20 opacity-[0.08]" />
                    <div>
                      <p className="t-title">Nothing here yet.</p>
                      <p className="t-body mt-1 text-sm text-ink-dim">
                        There&rsquo;s still time.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <ul>
                  {lines.map((line) => {
                    const custom =
                      line.attributes.name || line.attributes.number;
                    // Show the back when it's personalised — people need to check
                    // their own spelling before they pay.
                    const thumb = custom
                      ? (backOf(line.product.images) ?? line.product.images[0])
                      : line.product.images[0];

                    return (
                      <li
                        key={line.id}
                        className="flex gap-4 border-b border-hairline px-5 py-5"
                      >
                        <div className="relative aspect-shirt w-20 shrink-0 overflow-hidden bg-panel">
                          <ProductPhoto
                            image={thumb}
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex justify-between gap-3">
                            <p className="t-title truncate">
                              {line.product.title}
                            </p>
                            <p className="t-title shrink-0 tabular-nums">
                              {formatPrice(
                                line.variant.price.cents * line.quantity,
                                line.variant.price.currency,
                              )}
                            </p>
                          </div>

                          <p className="t-meta mt-1 text-ink-dim">
                            {Object.values(line.variant.options).join(" · ") ||
                              "One size"}
                          </p>

                          {custom && (
                            <p className="t-meta mt-1 [color:var(--g-1)]">
                              {[line.attributes.name, line.attributes.number]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <QtyStepper
                              size="sm"
                              value={line.quantity}
                              max={20}
                              onChange={(q) => update(line.id, q)}
                            />
                            <ChipButton
                              onClick={() => remove(line.id)}
                              className="border-hairline text-ink-dim"
                            >
                              Remove
                            </ChipButton>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-hairline px-5 py-5">
                <div className="mb-1 flex justify-between">
                  <p className="t-label">Subtotal</p>
                  <p className="t-label tabular-nums">
                    {formatPrice(subtotal)}
                  </p>
                </div>
                <p className="t-meta mb-4 text-ink-dim">
                  Delivery {formatPrice(DELIVERY.beirut)} in Beirut ·{" "}
                  {formatPrice(DELIVERY.lebanon)} across Lebanon · free over{" "}
                  {formatPrice(FREE_SHIPPING_CENTS)}
                </p>
                {hostedCheckout ? (
                  <a
                    href={hostedCheckout}
                    className="gradient-fill-deep t-label flex h-14 items-center justify-center transition-opacity duration-150 hover:opacity-90"
                  >
                    Checkout →
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep("checkout")}
                    className="gradient-fill-deep t-label flex h-14 w-full items-center justify-center transition-opacity duration-150 hover:opacity-90"
                  >
                    Checkout →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
