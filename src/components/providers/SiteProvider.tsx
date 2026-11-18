"use client";

import type Lenis from "lenis";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type SiteState = {
  lenis: Lenis | null;
  isPreloaderComplete: boolean;
  completePreloader: () => void;
};

const SiteContext = createContext<SiteState>({
  lenis: null,
  isPreloaderComplete: false,
  completePreloader: () => {},
});

export const useSite = () => useContext(SiteContext);

/**
 * Lenis runs its own frame loop (autoRaf). It used to ride GSAP's ticker so
 * it could share a clock with ScrollTrigger; ScrollTrigger is gone, and the
 * shared clock was the only reason every page loaded GSAP.
 *
 * Lenis smooths the wheel and nothing else (lerp 0.1, syncTouch false), so
 * it only loads on mouse-and-trackpad devices. On a phone it was a download
 * and a per-frame tick that changed nothing — and ~75% of visits are phones.
 * Anyone who has asked their system for reduced motion keeps native
 * scrolling too. Everything that uses `lenis` already copes with null.
 */
export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [isPreloaderComplete, setComplete] = useState(false);

  const completePreloader = useCallback(() => setComplete(true), []);

  useEffect(() => {
    const wanted =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      // The shop editor scrolls natively.
      !window.location.pathname.startsWith("/admin");
    if (!wanted) return;

    let cancelled = false;
    let instance: Lenis | null = null;

    // Loaded on demand, so the file is never sent to a phone.
    import("lenis").then(({ default: LenisCtor }) => {
      if (cancelled) return;
      // Smooth in-page jumps from the masthead links; sections carry their
      // own scroll-margin to clear the fixed header.
      instance = new LenisCtor({ anchors: true, autoRaf: true });
      // Arrived while the preloader holds the page: hold too. The preloader
      // starts it again at handover.
      if (document.documentElement.classList.contains("preloading")) instance.stop();
      setLenis(instance);
    });

    return () => {
      cancelled = true;
      instance?.destroy();
      setLenis(null);
    };
  }, []);

  return (
    <SiteContext.Provider
      value={{ lenis, isPreloaderComplete, completePreloader }}
    >
      {children}
    </SiteContext.Provider>
  );
}
