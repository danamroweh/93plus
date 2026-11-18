"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Sparkle } from "@/components/ui/Logo";
import { ChipButton } from "@/components/ui/Buttons";
import type { PlacedOrder } from "@/lib/commerce/actions";
import {
  INSTAGRAM_URL,
  TRANSFER_NUMBER_DISPLAY,
  deliveryWindow,
  whatsappLink,
} from "@/lib/contact";

const LAST_ORDER = "93plus:last-order";
const KEEP_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The receipt outlives the drawer. Someone paying by Whish closes the cart,
 * opens the Whish app, and needs the number and the order code again — so
 * the last order is kept on the phone for two weeks and the empty cart
 * offers it back.
 */
export function saveLastOrder(order: PlacedOrder) {
  try {
    localStorage.setItem(LAST_ORDER, JSON.stringify(order));
  } catch {}
}

export function readLastOrder(): PlacedOrder | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER);
    if (!raw) return null;
    const order = JSON.parse(raw) as PlacedOrder;
    return Date.now() - Date.parse(order.placedAt) < KEEP_FOR_MS ? order : null;
  } catch {
    return null;
  }
}

/**
 * Order placed — good news, so it looks like good news. Green, the full
 * mark, a burst of sparkles. Everything under the burst is there to earn
 * trust: when it arrives, exactly how to pay, who to talk to, and the order
 * repeated back line by line.
 */
export function Confirmation({
  order,
  onDone,
  replay = true,
}: {
  order: PlacedOrder;
  onDone: () => void;
  /** Off when reopened from the empty cart — no fireworks the second time. */
  replay?: boolean;
}) {
  const hero = useRef<HTMLDivElement>(null);
  const transfer = order.payment !== "cash";
  const method = order.payment === "whish" ? "Whish" : "OMT";
  const eta = deliveryWindow(new Date(order.placedAt));
  const first = order.name.split(" ")[0];

  // GSAP loads here, on the one screen that needs it (Checkout warms it the
  // moment the form opens, so it's in memory by the time an order lands).
  useLayoutEffect(() => {
    if (!replay || !hero.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scope = hero.current;
    let cancelled = false;
    let ctx: { revert: () => void } | null = null;
    import("gsap").then(({ gsap }) => {
      if (cancelled) return;
      ctx = gsap.context(() => {
      const q = gsap.utils.selector(scope);
      gsap
        .timeline()
        .from(q("[data-mark]"), {
          scale: 0,
          rotate: -180,
          duration: 0.9,
          ease: "back.out(1.8)",
        })
        .fromTo(
          q("[data-spark]"),
          { x: 0, y: 0, scale: 0, autoAlpha: 1 },
          {
            x: (i) => Math.cos((i / 12) * Math.PI * 2) * (90 + (i % 3) * 30),
            y: (i) => Math.sin((i / 12) * Math.PI * 2) * (70 + (i % 3) * 24),
            scale: (i) => 0.6 + (i % 3) * 0.35,
            rotate: 90,
            autoAlpha: 0,
            duration: 1.3,
            ease: "expo.out",
            stagger: 0.015,
          },
          "-=0.55",
        )
        .from(
          q("[data-rise]"),
          { y: 18, autoAlpha: 0, duration: 0.6, ease: "expo.out", stagger: 0.08 },
          "-=1.1",
        );
      }, scope);
    });
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [replay]);

  return (
    // Block flow inside the scroller, not flex: as flex children the sections
    // shrank to fit the drawer and the green header collapsed to a sliver.
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
      <div
        ref={hero}
        className="gradient-win relative overflow-hidden px-6 pt-10 pb-8 text-center text-white"
      >
        <div aria-hidden className="win-shine pointer-events-none absolute inset-0" />

        <div className="relative mx-auto h-28 w-28">
          {Array.from({ length: 12 }, (_, i) => (
            <Sparkle
              key={i}
              data-spark
              className="invisible absolute top-1/2 left-1/2 -mt-2 -ml-2 h-4 w-4 text-[#eaffb0]"
            />
          ))}
          <div data-mark className="relative">
            <Sparkle className="h-28 w-28 drop-shadow-[0_6px_24px_rgba(234,255,176,0.55)]" />
          </div>
        </div>

        <p data-rise className="t-display relative mt-6 text-[2.75rem] leading-[0.95]">
          Order confirmed
        </p>
        <p data-rise className="t-label relative mt-3 opacity-95">
          Thank you{first ? `, ${first}` : ""}. It&rsquo;s in.
        </p>
        <p
          data-rise
          className="t-label relative mx-auto mt-5 inline-flex items-center gap-2 border border-white/60 px-3 py-2 tabular-nums"
        >
          Order {order.number}
        </p>
      </div>

      <section className="border-b border-hairline px-6 py-5">
        <p className="t-meta text-ink-dim">Arrives</p>
        <p className="t-title mt-1 text-2xl">
          {eta.from} – {eta.to}
        </p>
        <p className="t-meta mt-1 text-ink-dim">
          Never later than {eta.latest}, printing included
        </p>
      </section>

      {transfer ? (
        <section className="border-b border-hairline px-6 py-5">
          <p className="t-meta mb-3 text-ink-dim">Pay by {method} — 3 steps</p>
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              Send <strong>{order.total}</strong> by {method} to{" "}
              <strong className="whitespace-nowrap">{TRANSFER_NUMBER_DISPLAY}</strong>
              <Copy text={TRANSFER_NUMBER_DISPLAY.replace(/\s/g, "")} />
            </Step>
            <Step n={2}>
              Write <strong className="whitespace-nowrap">{order.number}</strong> in
              the note
              <Copy text={order.number} />
            </Step>
            <Step n={3}>
              Send us the receipt on WhatsApp. We confirm as soon as it lands
              and ship the same day.
            </Step>
          </ol>
          <a
            href={whatsappLink(
              `Hi 93+, I sent ${order.total} by ${method} for order ${order.number}. Receipt attached.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="gradient-win t-label mt-5 flex h-12 items-center justify-center gap-2 text-white"
          >
            Send receipt on WhatsApp
          </a>
        </section>
      ) : (
        <section className="border-b border-hairline px-6 py-5">
          <p className="t-meta mb-2 text-ink-dim">Paying</p>
          <p className="t-body text-ink-mid">
            Cash at the door — <strong className="text-ink">{order.total}</strong>.
            We&rsquo;ll call <strong className="whitespace-nowrap text-ink">{order.phone}</strong>{" "}
            to confirm before it ships. Nothing to pay before then.
          </p>
        </section>
      )}

      <section className="border-b border-hairline px-6 py-5">
        <ul className="flex flex-col gap-2.5">
          <Trust>A real person confirms every order on WhatsApp.</Trust>
          <Trust>Wrong size or not right? Swap or refund within 30 days.</Trust>
          <Trust>
            See who you&rsquo;re buying from —{" "}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              @ninety_three_plus
            </a>{" "}
            on Instagram.
          </Trust>
        </ul>
      </section>

      <section className="px-6 py-5">
        <p className="t-meta mb-3 text-ink-dim">Your order</p>
        <ul className="flex flex-col gap-3">
          {order.lines.map((line, i) => (
            <li key={i} className="flex justify-between gap-4">
              <div className="min-w-0">
                <p className="t-title">
                  {line.quantity > 1 && `${line.quantity}× `}
                  {line.title}
                </p>
                <p className="t-meta mt-0.5 text-ink-dim">{line.detail}</p>
              </div>
              <p className="t-title shrink-0 tabular-nums">{line.price}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-hairline pt-3">
          <Row label="Subtotal" value={order.subtotal} />
          <Row label="Delivery" value={order.delivery} />
          <div className="mt-2 flex justify-between">
            <p className="t-label">Total</p>
            <p className="t-label tabular-nums">{order.total}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-hairline pt-3">
          <p className="t-meta mb-1 text-ink-dim">Delivering to</p>
          <p className="t-body">
            {order.name} · {order.phone}
            <br />
            {order.area} — {order.address}
          </p>
        </div>

        <p className="t-meta mt-6 text-ink-dim">
          Screenshot this — it&rsquo;s your receipt. It also stays in your cart
          for two weeks.
        </p>
        <Link
          href={`/order?n=${order.number}`}
          className="t-meta mt-3 inline-block text-ink underline underline-offset-2"
        >
          Track this order
        </Link>
        <ChipButton onClick={onDone} className="mt-5 mb-2">
          Keep shopping
        </ChipButton>
      </section>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="t-label flex h-6 w-6 shrink-0 items-center justify-center bg-[#2f7a12] text-white">
        {n}
      </span>
      <p className="t-body pt-0.5 text-ink-mid [&_strong]:text-ink">{children}</p>
    </li>
  );
}

function Trust({ children }: { children: React.ReactNode }) {
  return (
    <li className="t-body flex gap-2.5 text-sm text-ink-mid">
      <svg viewBox="0 0 14 14" aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f7a12]">
        <path d="m1.5 7.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="t-meta ml-2 inline-flex h-7 items-center border border-hairline px-2 align-middle text-ink hover:border-ink"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1 flex justify-between">
      <p className="t-meta text-ink-dim">{label}</p>
      <p className="t-meta tabular-nums text-ink">{value}</p>
    </div>
  );
}
