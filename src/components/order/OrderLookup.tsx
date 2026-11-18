"use client";

import { useEffect, useState, useTransition } from "react";
import { lookupOrderAction, type LookupResult } from "@/lib/commerce/actions";
import { deliveryWindow, whatsappLink } from "@/lib/contact";
import { cn } from "@/lib/utils";

/** The sheet's Status column, in the order an order moves through it. */
const STEPS = ["New", "Confirmed", "Paid", "Out for delivery", "Delivered"];

/** 16px, not the 13px label size, or iOS zooms into the field and stays there. */
const FIELD =
  "w-full border border-hairline bg-transparent px-4 py-3 text-base font-medium uppercase tracking-[0.04em] placeholder:text-ink-dim focus:border-ink focus:outline-none";

export function OrderLookup() {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<(LookupResult & { ok: true }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The receipt links here with the number filled in.
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("n");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (n) setNumber(n);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await lookupOrderAction(number, phone);
      if (r.ok) setResult(r);
      else {
        setResult(null);
        setError(r.error);
      }
    });
  };

  const reached = result ? STEPS.indexOf(result.status) : -1;
  const cancelled = result?.status === "Cancelled";
  const eta = result ? deliveryWindow(new Date(result.placedAt)) : null;

  return (
    <div className="max-w-xl">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="t-meta text-ink-dim">Order number</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="93-1022-1234"
            inputMode="numeric"
            autoComplete="off"
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-meta text-ink-dim">Last 4 digits of your phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="3456"
            inputMode="numeric"
            autoComplete="off"
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
        {error && (
          <p role="alert" className="t-meta text-ink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="t-label h-[50px] border border-ink bg-ink px-6 text-ground transition-opacity duration-150 hover:opacity-85 disabled:opacity-40"
        >
          {isPending ? "Looking…" : "Find my order"}
        </button>
      </form>

      {result && (
        <section className="mt-12 border-t border-hairline pt-6">
          <p className="t-meta text-ink-dim">Order {result.number}</p>

          {cancelled ? (
            <p className="t-title mt-3">Cancelled. If that&rsquo;s a surprise, message us.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-2.5">
              {STEPS.map((step, i) => {
                const done = i <= reached;
                const current = i === reached;
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        done ? "bg-ink" : "border border-hairline",
                      )}
                    />
                    <span className={cn("t-label", done ? "text-ink" : "text-ink-dim")}>
                      {step}
                      {current && reached < STEPS.length - 1 && (
                        <span className="t-meta ml-2 normal-case text-ink-mid">now</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {!cancelled && reached < STEPS.length - 1 && eta && (
            <p className="t-meta mt-5 text-ink-dim">
              Arrives {eta.from} – {eta.to}, never later than {eta.latest}
            </p>
          )}

          <div className="mt-6 border-t border-hairline pt-4">
            <p className="t-meta mb-2 text-ink-dim">Items</p>
            <p className="t-body whitespace-pre-line">{result.items}</p>
            <div className="mt-3 flex justify-between">
              <p className="t-label">Total</p>
              <p className="t-label tabular-nums">{result.total}</p>
            </div>
          </div>

          <a
            href={whatsappLink(`Hi 93+, about order ${result.number}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="t-meta mt-6 inline-block text-ink underline underline-offset-2"
          >
            Ask us about this order on WhatsApp
          </a>
        </section>
      )}
    </div>
  );
}
