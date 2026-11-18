"use client";

import { useEffect, useRef } from "react";
import { Logo } from "@/components/ui/Logo";
import { useSite } from "@/components/providers/SiteProvider";
import { HOME_PATH, SEEN_FOR_MS, SEEN_KEY } from "@/lib/preloader";
import { formatClock, type Season } from "@/lib/seasons";

/**
 * Start fetching GSAP the moment this file runs in the browser — before the
 * page has finished waking up — when the preloader is about to play: home
 * page, not seen this month (the inline script in layout.tsx has already
 * decided that and left `data-preloaded` off). Everyone else never asks.
 */
const gsapEarly =
  typeof window !== "undefined" &&
  HOME_PATH.test(window.location.pathname) &&
  !("preloaded" in document.documentElement.dataset)
    ? import("gsap")
    : null;

/**
 * The brand moment, and the only place the site spends real time.
 *
 * OUTFIT's preloader is black on a cream site — the inverse of the page,
 * so the wipe is a genuine reversal. Ours fills with the season's gradient
 * and carries a black wordmark, which is the lockup from the brand sheet.
 * The site opens in the colour of whatever part of the football calendar
 * it is, then wipes away to the off-white page.
 *
 * The clock is the thing nobody else can do, because nobody else is named
 * after a minute: it counts real match time into stoppage, and in knockout
 * season it counts to 120 instead of 93.
 *
 * Plays on the home page only, once per visitor per month (localStorage).
 * A shirt link opened from WhatsApp goes straight to the shirt, and the
 * moment is kept for the first time that visitor opens the home page.
 * Returning visitors never see it: an inline script in the root layout hides
 * it before first paint, so a slow phone isn't staring at a gradient waiting
 * for JS. ~3s. OUTFIT's is 4.6s, which is right for a studio flex and far
 * too long for a shop.
 *
 * GSAP is fetched only when it plays, so nobody else downloads it.
 */
export function Preloader({ season }: { season: Season }) {
  const root = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const { lenis, isPreloaderComplete, completePreloader } = useSite();

  // Read inside the once-only effect below, so a later render can't replay it.
  const latest = useRef({ season, completePreloader, lenis });
  useEffect(() => {
    latest.current = { season, completePreloader, lenis };
  });

  /**
   * Scroll restart lives here, not in the timeline: driving it off the
   * completion flag can't be cancelled by a timeline being torn down, and it
   * self-heals whichever order the preloader and Lenis (desktop, loaded on
   * demand) arrive in.
   */
  useEffect(() => {
    if (isPreloaderComplete && lenis?.isStopped) lenis.start();
  }, [isPreloaderComplete, lenis]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const html = document.documentElement;
    const { season } = latest.current;

    const handover = (remember = true) => {
      html.classList.remove("preloading");
      html.classList.add("loaded");
      latest.current.completePreloader();
      if (!remember) return;
      try {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        /* private mode — the preloader just runs again */
      }
    };
    const hide = () => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.display = "none";
    };
    const skip = (remember = true) => {
      hide();
      handover(remember);
    };

    // Landed on a shirt, a collection, a page — not the home page. Straight
    // in, and nothing remembered, so the home page still gets its moment.
    if (!HOME_PATH.test(window.location.pathname)) {
      skip(false);
      return;
    }

    // Already seen recently: skip straight to the shop.
    let seen = "preloaded" in html.dataset;
    try {
      seen ||= Date.now() - Number(localStorage.getItem(SEEN_KEY)) < SEEN_FOR_MS;
    } catch {
      /* ignore */
    }
    if (seen) {
      skip();
      return;
    }

    // Reduced motion: no brand moment, straight to the shop.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      skip();
      return;
    }

    // On a slow connection, or with the phone's data saver on, the shop
    // already arrives late — three seconds of gradient on top of that is
    // a wait, not a moment. Chrome and Android report this; others
    // (Safari) don't, and keep the full version.
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData || /(^|-)2g$|^3g$/.test(connection?.effectiveType ?? "")) {
      skip();
      return;
    }

    // Loaded into a background tab: rAF is paused, so the timeline would
    // sit frozen and the shop would be scroll-locked behind a preloader
    // nobody is watching. There's no brand moment to protect if the tab
    // isn't in front, so hand over immediately.
    if (document.visibilityState !== "visible") {
      skip();
      return;
    }

    window.scrollTo({ top: 0, behavior: "instant" });
    latest.current.lenis?.scrollTo(0, { immediate: true });
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    // Scroll lock for the ~3s (globals.css); Lenis, where it runs, holds too.
    html.classList.add("preloading");
    latest.current.lenis?.stop();

    let cancelled = false;
    let ctx: { revert: () => void } | null = null;
    let kill: (() => void) | null = null;

    (gsapEarly ?? import("gsap")).then(({ gsap }) => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        const paths = logoRef.current?.querySelectorAll("path") ?? [];
        gsap.set(paths, { yPercent: 110, willChange: "transform" });
        // Hidden in the markup until the letters are tucked away, so the
        // wordmark never flashes at rest before it rises.
        gsap.set(logoRef.current, { visibility: "visible" });

        const counter = { value: season.clock.from };
        const paint = () => {
          if (clockRef.current) clockRef.current.textContent = formatClock(counter.value);
        };
        paint();

        const tl = gsap.timeline({
          delay: 0.3,
          defaults: { force3D: true },
          onComplete: () => gsap.set(paths, { willChange: "auto" }),
        });
        kill = () => tl.kill();

        tl.to(paths, {
          yPercent: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: { each: 0.12, from: "random" },
        })
          // 90:00 → 93:24 (or 117:00 → 120:18 in knockout season)
          .to(
            counter,
            {
              value: season.clock.to,
              duration: 1.9,
              ease: "circ.inOut",
              onUpdate: paint,
            },
            0,
          )
          // the payoff — the clock resolves into the name of the shop
          .call(() => {
            if (clockRef.current) clockRef.current.textContent = season.clock.label;
          })
          .to(clockRef.current, {
            yPercent: -100,
            autoAlpha: 0,
            duration: 0.6,
            ease: "circ.inOut",
          })
          .to(
            paths,
            {
              yPercent: -120,
              duration: 0.9,
              ease: "expo.inOut",
              stagger: { each: 0.06, from: "random" },
            },
            "<",
          )
          .to(
            el,
            {
              clipPath: "inset(0% 0% 100% 0%)",
              duration: 1.1,
              ease: "power2.inOut",
            },
            "<30%",
          )
          .call(handover, undefined, "<50%");
      }, el);
    });

    // Failsafe. Nothing about a shop should depend on an animation
    // finishing (or the animation library arriving) — a stalled timeline
    // would leave the page scroll-locked with no header and no way out. If
    // it hasn't handed over by 6s, tear it down and show the shop regardless.
    const bail = window.setTimeout(() => {
      if (html.classList.contains("loaded")) return;
      kill?.();
      hide();
      handover();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearTimeout(bail);
      ctx?.revert();
    };
    // Once per page load, by design: a later render must never replay it.
  }, []);

  return (
    <div
      ref={root}
      id="preloader"
      aria-hidden
      style={{ clipPath: "inset(0% 0% 0% 0%)", contain: "layout paint style" }}
      className="gradient-fill fixed inset-0 z-50 flex items-center justify-center px-6 text-[#0a0a0a]"
    >
      <div className="relative w-[58%] max-w-[52rem] md:w-full">
        <div ref={logoRef} className="overflow-hidden" style={{ visibility: "hidden" }}>
          <Logo className="w-full" />
        </div>
        <div className="absolute top-full right-0 mt-4 overflow-hidden md:top-0 md:-right-4 md:mt-0 md:translate-x-full">
          <span
            ref={clockRef}
            className="t-label block text-right tabular-nums"
          >
            {formatClock(season.clock.from)}
          </span>
        </div>
      </div>
    </div>
  );
}
