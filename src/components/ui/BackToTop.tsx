"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSite } from "@/components/providers/SiteProvider";
import { cn } from "@/lib/utils";

/**
 * Appears once the masthead is out of view, so the way back to the shop
 * links is always one tap away on a long scroll. Sits under the cart drawer
 * (z-30 vs z-40) so it never floats over checkout.
 */
export function BackToTop() {
  const { lenis } = useSite();
  const [visible, setVisible] = useState(false);
  // On a product page the corner is where Add to cart scrolls past — the
  // button sat right on top of it on a phone.
  const pathname = usePathname();
  const onProduct = pathname.startsWith("/product/") || pathname.startsWith("/admin");

  useEffect(() => {
    const sync = () => setVisible(window.scrollY > 600);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  const toTop = () => {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (onProduct) return null;

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed right-4 bottom-4 z-30 flex h-11 w-11 items-center justify-center bg-ink text-ground transition-all duration-200 lg:right-6 lg:bottom-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <svg
        width="15"
        height="10"
        viewBox="0 0 15 10"
        fill="none"
        aria-hidden
        className="-rotate-90"
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
