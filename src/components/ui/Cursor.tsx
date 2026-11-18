"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Desktop only — returns null on touch and under 768px, so no DOM at all
 * for the ~75% of traffic that can't use it.
 *
 * The dot trails the pointer the way a GSAP expo.out tween of 0.8 s did
 * when it was re-aimed on every move: that is exactly an exponential follow
 * that closes half the remaining distance every 0.08 s. Done here in one
 * animation frame loop, so the page doesn't load an animation library for a
 * dot. The very first move snaps, so the dot doesn't fly in from the corner.
 */
const HALF_LIFE_MS = 80;

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [inside, setInside] = useState(true);
  const [isText, setIsText] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();
  // The shop editor is a working tool: the system pointer, not the brand dot.
  const inEditor = pathname.startsWith("/admin");

  useEffect(() => {
    const mq = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 768px)",
    );
    const apply = () => setEnabled(mq.matches && !inEditor);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [inEditor]);

  useEffect(() => {
    if (!enabled) return;
    const pos = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let started = false;
    let frame = 0;
    let last = 0;

    const paint = () => {
      if (dot.current) dot.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    };
    const step = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const k = 1 - 2 ** (-dt / HALF_LIFE_MS);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      if (Math.abs(target.x - pos.x) < 0.1 && Math.abs(target.y - pos.y) < 0.1) {
        pos.x = target.x;
        pos.y = target.y;
        frame = 0;
      } else frame = requestAnimationFrame(step);
      paint();
    };

    const onMove = ({ clientX, clientY }: MouseEvent) => {
      target.x = clientX;
      target.y = clientY;
      if (!started) {
        started = true;
        pos.x = clientX;
        pos.y = clientY;
        paint();
        setHasMoved(true);
        return;
      }
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };
    const leave = () => setInside(false);
    const enter = () => setInside(true);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", leave);
    document.addEventListener("mouseenter", enter);
    document.documentElement.classList.add("has-custom-cursor");
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("mouseenter", enter);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [enabled]);

  // Rebound on navigation — the product list changes under it.
  useEffect(() => {
    if (!enabled) return;
    const targets = [...document.querySelectorAll('[data-cursor="text"]')];
    const on = () => setIsText(true);
    const off = () => setIsText(false);
    targets.forEach((t) => {
      t.addEventListener("mouseenter", on);
      t.addEventListener("mouseleave", off);
    });
    return () => {
      targets.forEach((t) => {
        t.removeEventListener("mouseenter", on);
        t.removeEventListener("mouseleave", off);
      });
      setIsText(false);
    };
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      style={{ opacity: hasMoved && inside ? 1 : 0 }}
      className="pointer-events-none fixed top-0 left-0 z-[9999] transition-opacity duration-200 will-change-transform"
    >
      <div ref={dot}>
        <div
          className={cn(
            "-mt-1 -ml-1 h-2 w-2 rounded-full transition-[width,height,margin] duration-200 ease-out",
            // Solid, not the gradient. At 8px a five-stop ramp is unreadable
            // as a gradient anyway, and at 100px it competes with the card
            // hover it's sitting on top of.
            "[background-color:var(--cursor-color)]",
            isText &&
              "-mt-[50px] -ml-[50px] flex h-[100px] w-[100px] items-center justify-center",
          )}
        >
          {isText && (
            <span className="t-meta text-ground">View</span>
          )}
        </div>
      </div>
    </div>
  );
}
