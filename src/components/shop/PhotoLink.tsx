"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/** The one element on a page allowed to carry the morph. */
export const PHOTO_TRANSITION = "product-photo";

type Doc = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

/**
 * The link from a card to its product page.
 *
 * Two things a plain <Link> doesn't do. It warms the next page the moment a
 * finger lands on the card (touchstart) or the pointer arrives, so the tap
 * itself has nothing left to wait for. And on browsers with the View
 * Transitions API (Chrome, Safari 18+) the card's photo morphs into the
 * product page's photo instead of cutting. Other browsers, and anyone who
 * asked for reduced motion, navigate exactly as before.
 */
export function PhotoLink({
  href,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const router = useRouter();
  const warm = () => router.prefetch(href);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const doc = document as Doc;
    if (
      !doc.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const photo = e.currentTarget.querySelector<HTMLElement>('[data-image="front"]');
    if (!photo) return;

    e.preventDefault();
    photo.style.viewTransitionName = PHOTO_TRANSITION;
    const transition = doc.startViewTransition(async () => {
      router.push(href);
      // The new page is in once the address has changed (Next updates it in
      // the same commit as the DOM). Rendering is paused while this runs, so
      // frame callbacks never fire — a timer polls instead. If the page
      // hasn't arrived within 1.5 s (a cold load on a slow link), go on
      // without the morph.
      const t0 = Date.now();
      await new Promise<void>((resolve) => {
        const tick = () =>
          location.pathname === href || Date.now() - t0 > 1500
            ? resolve()
            : setTimeout(tick, 16);
        tick();
      });
      // A beat for React's effects on the new page to settle.
      await new Promise((r) => setTimeout(r, 40));
    });
    transition.finished.finally(() => {
      photo.style.viewTransitionName = "";
    });
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={warm}
      onTouchStart={warm}
      {...rest}
    >
      {children}
    </Link>
  );
}
