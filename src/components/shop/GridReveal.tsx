"use client";

import { useEffect, useRef } from "react";
import { useSite } from "@/components/providers/SiteProvider";
import { easings } from "@/lib/easing";

/**
 * The card reveal: each photo comes in from x:-50% at scale 1.4 and settles,
 * on GSAP's expo.out, timeScale 0.85 — heavy rather than snappy.
 *
 * Run by the browser's own animation API (element.animate) with GSAP's
 * curve reproduced exactly (lib/easing.ts), so this file no longer pulls the
 * 27 KB library onto every page. The cover panel each card carries is parked
 * off-frame (ProductCard) and the GSAP version never brought it on, so the
 * photo's move is the whole reveal; that's what's kept.
 *
 * This is a brand moment, not functional UI, so it's allowed to be slow.
 * Everything you touch repeatedly (sizes, cart, drawers) runs at 150–250ms.
 */
const DURATION = 800 / 0.85;

export function GridReveal({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const { isPreloaderComplete } = useSite();

  useEffect(() => {
    if (!isPreloaderComplete || !scope.current) return;

    // rAF is paused in a background tab, so a reveal that starts there
    // freezes mid-flight and leaves the photo stuck zoomed and offset. A card
    // that never animates looks correct; a card frozen halfway looks broken.
    if (document.visibilityState !== "visible") return;
    // Someone who asked their phone for less motion gets the cards as they are.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { expoOut } = easings();
    const cards = [...scope.current.querySelectorAll<HTMLElement>("[data-product]")];
    const waiting = new Map<Element, Animation>();
    const running: Animation[] = [];

    const reveal = (front: HTMLElement, delay: number) => {
      front.style.willChange = "transform";
      const anim = front.animate(
        [{ transform: "translateX(-50%) scale(1.4)" }, { transform: "none" }],
        { duration: DURATION, delay, easing: expoOut, fill: "both" },
      );
      anim.onfinish = () => {
        anim.cancel(); // the end state is the photo's own, so nothing jumps
        front.style.willChange = "";
      };
      running.push(anim);
      return anim;
    };

    // "top 85%": play once the card's top crosses the line 15% up from the
    // bottom of the screen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          waiting.get(entry.target)?.play();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );

    cards.forEach((card, i) => {
      const front = card.querySelector<HTMLElement>('[data-image="front"]');
      if (!front) return;
      if (i < 3) {
        // The first row is on screen when the preloader hands over, so it
        // plays at once on a stagger rather than waiting for scroll.
        reveal(front, 350 + i * 80);
      } else {
        // Held at its first frame (zoomed in, shifted) until it scrolls in.
        const anim = reveal(front, 0);
        anim.pause();
        waiting.set(card, anim);
        io.observe(card);
      }
    });

    // Tab hidden mid-stagger: land everything on its end state.
    const onHide = () => {
      if (document.visibilityState === "visible") return;
      for (const a of running) if (a.playState !== "finished") a.finish();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [isPreloaderComplete]);

  return <div ref={scope}>{children}</div>;
}
