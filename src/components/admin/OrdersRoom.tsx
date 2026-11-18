"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ordersAction, setOrderStatusAction } from "@/app/admin/actions";
import { ORDER_STEPS, type AdminOrder, type OrderState } from "@/lib/admin/types";
import { cn, formatPrice } from "@/lib/utils";
import { Button, Dialog, IconButton, IconCheck, IconClose, Label, Sheet, Spinner, type ToastState } from "./parts";

/**
 * The order book. Newest first, grouped by where each order is: New (just
 * placed), Confirmed (you called them), Paid, Out for delivery, Delivered —
 * or Cancelled. One button moves an order to its next step; the customer's
 * tracking page follows. Cancelling puts counted stock back.
 */

type Filter = "todo" | OrderState | "all";

const TONE: Record<OrderState, string> = {
  New: "bg-ink text-ground",
  Confirmed: "bg-[#f3d9a4] text-[#6b4300]",
  Paid: "bg-[#d4e6f7] text-[#164a7a]",
  "Out for delivery": "bg-[#e7d7f3] text-[#4f2a73]",
  Delivered: "bg-[#d3ecd9] text-[#1f6234]",
  Cancelled: "bg-panel text-ink-dim line-through",
};

const statusOf = (o: AdminOrder): OrderState => o.status ?? "New";
const open = (o: AdminOrder) => !["Delivered", "Cancelled"].includes(statusOf(o));

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

/** Lebanese numbers as WhatsApp wants them: country code, digits only. */
function whatsappNumber(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  return `961${d}`;
}

export function StatusPill({ status, className }: { status: OrderState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center px-2.5 text-[12px] font-medium uppercase tracking-[0.05em] whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

export function OrdersRoom({
  orders,
  onOrders,
  onToast,
}: {
  orders: AdminOrder[];
  onOrders: (o: AdminOrder[]) => void;
  onToast: (t: ToastState) => void;
}) {
  const [filter, setFilter] = useState<Filter>("todo");
  const [openNumber, setOpenNumber] = useState<string | null>(null);

  // New orders arrive while the room is open: look every 30 seconds while
  // the tab is in front, and straight away when it comes back to the front.
  const refresh = useCallback(async () => {
    const next = await ordersAction().catch(() => null);
    if (next) onOrders(next);
  }, [onOrders]);
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void refresh();
    const t = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todo: 0, all: orders.length };
    for (const o of orders) {
      c[statusOf(o)] = (c[statusOf(o)] ?? 0) + 1;
      if (open(o)) c.todo += 1;
    }
    return c;
  }, [orders]);

  const shown = orders.filter((o) =>
    filter === "all" ? true : filter === "todo" ? open(o) : statusOf(o) === filter,
  );
  const current = orders.find((o) => o.number === openNumber) ?? null;
  const chips: { id: Filter; label: string }[] = [
    { id: "todo", label: "To do" },
    ...[...ORDER_STEPS, "Cancelled" as const].map((s) => ({ id: s as Filter, label: s })),
    { id: "all", label: "All" },
  ];

  // "This week" counts from when the list last arrived, not each render.
  const [since] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString());
  const weekCents = orders
    .filter((o) => statusOf(o) !== "Cancelled" && o.placedAt >= since)
    .reduce((n, o) => n + o.totalCents, 0);

  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-8 lg:px-8 lg:pt-12">
      <h1 className="t-display text-[clamp(2.75rem,8vw,5rem)] text-ink">Orders</h1>
      <p className="mt-3 text-[16px] text-ink-dim">
        {counts.New ? `${counts.New} new · ` : ""}
        {counts.todo} to do · {formatPrice(weekCents)} this week
      </p>

      <div className="scrollbar-hidden -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {chips.map((c) => {
          const n = counts[c.id] ?? 0;
          if (!n && c.id !== "todo" && c.id !== "all" && c.id !== filter) return null;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 border px-4 text-[15px] font-medium transition-colors",
                filter === c.id ? "border-ink bg-ink text-ground" : "border-ink/25 text-ink hover:border-ink",
              )}
            >
              {c.label}
              <span className={cn("tabular-nums", filter === c.id ? "text-ground/70" : "text-ink-dim")}>{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length ? (
        <ul className="mt-6 space-y-3">
          {shown.map((o) => {
            const lines = o.lines?.length ? o.lines : null;
            const first = lines ? `${lines[0].quantity}× ${lines[0].title}` : o.items.split("\n")[0];
            const more = lines ? lines.length - 1 : o.items.split("\n").length - 1;
            return (
              <li key={o.number}>
                <button
                  type="button"
                  onClick={() => setOpenNumber(o.number)}
                  aria-label={`Order ${o.number}, ${o.name}, ${o.total}, ${statusOf(o)}`}
                  className="group block w-full border border-ink/15 bg-surface p-4 text-left transition-colors hover:border-ink sm:p-5"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <StatusPill status={statusOf(o)} />
                    <span className="text-[14px] text-ink-dim tabular-nums">
                      {o.number} · {when(o.placedAt)}
                    </span>
                    <span className="ml-auto text-[18px] font-medium text-ink tabular-nums">{o.total}</span>
                  </span>
                  <span className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[18px] font-medium text-ink">
                      {o.name} <span className="font-normal text-ink-dim">· {o.area}</span>
                    </span>
                    <span className="text-[14px] text-ink-dim">{o.payment}</span>
                  </span>
                  <span className="mt-1 block truncate text-[15px] text-ink-mid">
                    {first}
                    {more > 0 && ` + ${more} more`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-[20px] font-medium text-ink">
            {orders.length ? "Nothing here." : "No orders yet."}
          </p>
          <p className="mt-2 text-[16px] text-ink-dim">
            {orders.length
              ? "Every order in this group is done."
              : "When someone orders, it shows up here within a few seconds."}
          </p>
        </div>
      )}

      {current && (
        <OrderSheet
          key={current.number}
          order={current}
          onClose={() => setOpenNumber(null)}
          onSaved={(o, message) => {
            onOrders(orders.map((x) => (x.number === o.number ? o : x)));
            onToast({ text: message });
          }}
        />
      )}
    </main>
  );
}

function OrderSheet({
  order,
  onClose,
  onSaved,
}: {
  order: AdminOrder;
  onClose: () => void;
  onSaved: (o: AdminOrder, message: string) => void;
}) {
  const [saving, setSaving] = useState<OrderState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const status = statusOf(order);
  const cancelled = status === "Cancelled";
  const at = ORDER_STEPS.indexOf(status);
  const next = !cancelled && at < ORDER_STEPS.length - 1 ? ORDER_STEPS[at + 1] : null;
  const wa = whatsappNumber(order.phone);
  const hello = encodeURIComponent(`Hi ${order.name.split(" ")[0]}, it's 93+ about your order ${order.number}.`);

  async function move(to: OrderState) {
    setSaving(to);
    setError(null);
    try {
      const res = await setOrderStatusAction(order.number, to);
      if (res.ok)
        onSaved(
          res.order,
          to === "Cancelled"
            ? `Order ${order.number} is cancelled.`
            : cancelled
              ? `Order ${order.number} is open again.`
              : `Order ${order.number}: ${to}.`,
        );
      else setError(res.error);
    } catch {
      setError("Couldn't save. Check the internet and try again.");
    } finally {
      setSaving(null);
      setAsk(false);
    }
  }

  return (
    <Sheet label={`Order ${order.number}`} width="narrow" onClose={onClose}>
      <header className="flex h-16 shrink-0 items-center gap-1 border-b border-hairline pr-3 pl-1 sm:pl-2">
        <IconButton label="Close" onClick={onClose}>
          <IconClose className="h-6 w-6" />
        </IconButton>
        <h2 className="flex-1 text-[18px] font-medium text-ink tabular-nums">Order {order.number}</h2>
        <StatusPill status={status} />
      </header>

      <div className="flex-1 space-y-9 overflow-y-auto px-4 py-6 sm:px-6" data-lenis-prevent>
        <section>
          <p className="text-[26px] leading-tight font-medium text-ink">{order.name}</p>
          <p className="mt-1 text-[15px] text-ink-dim">Ordered {when(order.placedAt)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={`tel:${order.phone.replace(/[^\d+]/g, "")}`}
              className="flex h-14 items-center justify-center gap-2 border border-ink/35 text-[15px] font-medium uppercase tracking-[0.04em] text-ink hover:border-ink hover:bg-ink hover:text-ground"
            >
              Call
            </a>
            <a
              href={`https://wa.me/${wa}?text=${hello}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-14 items-center justify-center gap-2 bg-[#1f7a3f] text-[15px] font-medium uppercase tracking-[0.04em] text-white hover:bg-[#186332]"
            >
              WhatsApp
            </a>
          </div>
          <dl className="mt-5 space-y-3 text-[16px]">
            <Row label="Phone" value={order.phone} />
            <Row label="Area" value={order.area} />
            <Row label="Address" value={order.address} />
            {order.notes && <Row label="Notes" value={order.notes} />}
            <Row label="Payment" value={order.payment} />
          </dl>
        </section>

        <section>
          <Label>Where it is</Label>
          {cancelled ? (
            <p className="text-[16px] text-ink-dim">
              Cancelled{order.restocked ? " — counted items went back in stock." : "."}
            </p>
          ) : (
            <ol className="space-y-2">
              {ORDER_STEPS.map((step, i) => {
                const done = i <= at;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      disabled={Boolean(saving) || step === status}
                      onClick={() => move(step)}
                      className={cn(
                        "flex h-12 w-full items-center gap-3 border px-4 text-left text-[16px] transition-colors",
                        step === status
                          ? "border-ink bg-ink text-ground"
                          : done
                            ? "border-ink/20 bg-surface text-ink"
                            : "border-dashed border-ink/25 text-ink-dim hover:border-ink hover:text-ink",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border text-[12px]",
                          done ? "border-current" : "border-ink/30",
                        )}
                      >
                        {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className="flex-1">{step}</span>
                      {saving === step && <Spinner />}
                      {step === status && <span className="text-[12px] uppercase tracking-[0.06em] opacity-80">Now</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[14px] text-ink-dim">The customer sees this on their tracking page.</p>
        </section>

        <section>
          <Label aside={`${(order.lines ?? []).reduce((n, l) => n + l.quantity, 0) || ""}`}>Items</Label>
          {order.lines?.length ? (
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {order.lines.map((l, i) => (
                <li key={i} className="flex gap-4 py-3">
                  <span className="w-8 shrink-0 text-[18px] font-medium text-ink tabular-nums">{l.quantity}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium text-ink">{l.title}</span>
                    <span className="block text-[14px] text-ink-dim">
                      {Object.values(l.options).join(" · ") || "One size"}
                    </span>
                    {l.print && (
                      <span className="mt-1 inline-block bg-panel px-2 py-0.5 text-[14px] font-medium text-ink">
                        Print: {l.print}
                      </span>
                    )}
                  </span>
                  <span className="text-[16px] text-ink tabular-nums">{formatPrice(l.priceCents * l.quantity)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[16px] whitespace-pre-line text-ink">{order.items}</p>
          )}
          <dl className="mt-4 space-y-1.5 text-[16px]">
            <Row label="Items" value={order.subtotal} />
            <Row label="Delivery" value={order.delivery} />
            <div className="flex justify-between border-t border-ink/15 pt-2 text-[20px] font-medium text-ink">
              <dt>Total</dt>
              <dd className="tabular-nums">{order.total}</dd>
            </div>
          </dl>
        </section>

        {order.history && order.history.length > 1 && (
          <section>
            <Label>History</Label>
            <ul className="space-y-1 text-[15px] text-ink-dim">
              {order.history.map((h, i) => (
                <li key={i}>
                  {h.status} · {when(h.at)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="shrink-0 border-t border-hairline bg-ground px-3 py-3 sm:px-6">
        {error && <p className="mb-3 text-[16px] font-medium text-ink">{error}</p>}
        <div className="flex items-center gap-2">
          {cancelled ? (
            <Button tone="primary" size="lg" className="ml-auto" disabled={Boolean(saving)} onClick={() => move("New")}>
              {saving && <Spinner />} Reopen order
            </Button>
          ) : (
            <>
              <Button tone="quiet" className="px-3" disabled={Boolean(saving)} onClick={() => setAsk(true)}>
                Cancel order
              </Button>
              {next ? (
                <Button tone="primary" size="lg" className="ml-auto" disabled={Boolean(saving)} onClick={() => move(next)}>
                  {saving === next && <Spinner />} Mark as {next.toLowerCase()}
                </Button>
              ) : (
                <Button tone="primary" size="lg" className="ml-auto" onClick={onClose}>
                  Done
                </Button>
              )}
            </>
          )}
        </div>
      </footer>

      {ask && (
        <Dialog
          title={`Cancel order ${order.number}?`}
          onClose={() => setAsk(false)}
          actions={
            <>
              <Button tone="outline" onClick={() => setAsk(false)}>
                Keep it
              </Button>
              <Button tone="danger" disabled={Boolean(saving)} onClick={() => move("Cancelled")}>
                {saving && <Spinner />} Cancel order
              </Button>
            </>
          }
        >
          Any counted stock goes back on the shelf. You can reopen it later.
        </Dialog>
      )}
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-ink-dim">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-ink">{value}</dd>
    </div>
  );
}
