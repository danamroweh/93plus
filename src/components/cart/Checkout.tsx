"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useCart } from "./CartProvider";
import { Confirmation, saveLastOrder } from "./Confirmation";
import { Arrow, ChipButton } from "@/components/ui/Buttons";
import {
  placeOrderAction,
  type PlacedOrder,
} from "@/lib/commerce/actions";
import {
  AREAS,
  DELIVERY_DAYS,
  PAYMENT_METHODS,
  deliveryFor,
  type PaymentMethod,
} from "@/lib/contact";
import { cn, formatPrice } from "@/lib/utils";
type Field = "name" | "phone" | "area" | "address" | "payment";

/**
 * A key for this checkout screen. If the button is tapped twice, or the
 * network retries the request, the server sees the same key and places the
 * order once. randomUUID needs https; on the LAN it falls back.
 */
function orderKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * One screen, inside the drawer — the buyer never leaves the site.
 *
 * Ordered by what the courier needs: phone first (the one thing that makes
 * a delivery happen), then area (which sets the delivery price live), then
 * the address the way Lebanese addresses actually work — by landmark.
 * Payment is two taps: cash at the door is the default because it's how
 * most of the country pays.
 */
export function Checkout({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const { cart, clear } = useCart();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<{ field?: Field; message: string } | null>(
    null,
  );
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [isPending, startTransition] = useTransition();
  const key = useRef<string | null>(null);
  if (key.current == null) key.current = orderKey();

  // The confirmation's sparkle burst runs on GSAP, which no page loads up
  // front any more. Fetch it while the form is being filled in.
  useEffect(() => {
    import("gsap").catch(() => {});
  }, []);

  if (placed) return <Confirmation order={placed} onDone={onDone} />;

  const subtotal = cart?.subtotal.cents ?? 0;
  const delivery = area ? deliveryFor(area, subtotal) : null;
  const total = subtotal + (delivery ?? 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await placeOrderAction({
        name,
        phone,
        area,
        address,
        payment,
        notes,
        idempotencyKey: key.current ?? undefined,
      });
      if (result.ok) {
        const order: PlacedOrder = result;
        setPlaced(order);
        saveLastOrder(order);
        clear();
      } else setError({ field: result.field as Field, message: result.error });
    });
  };

  const invalid = (f: Field) => error?.field === f;

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-6" data-lenis-prevent>
        <ChipButton onClick={onBack} className="mb-6">
          <Arrow className="rotate-180" />
          Back to cart
        </ChipButton>

        <fieldset className="flex flex-col gap-5">
          <legend className="t-meta mb-4 text-ink-dim">Delivery</legend>

          <Input
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="71 123 456"
            value={phone}
            onChange={setPhone}
            invalid={invalid("phone")}
          />
          <Input
            label="Name"
            autoComplete="name"
            value={name}
            onChange={setName}
            invalid={invalid("name")}
          />

          <label className="flex flex-col gap-1.5">
            <span className="t-meta text-ink-dim">Area</span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={cn(
                "t-body h-11 w-full appearance-none rounded-none border-b bg-transparent text-base outline-none",
                invalid("area")
                  ? "border-ink"
                  : "border-hairline focus:border-ink",
                !area && "text-ink-dim",
              )}
            >
              <option value="" disabled>
                Choose your area
              </option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="t-meta text-ink-dim">Address</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              autoComplete="street-address"
              placeholder="Building, street, nearest landmark"
              className={cn(
                "t-body w-full resize-none rounded-none border-b bg-transparent py-2 text-base outline-none placeholder:text-ink-dim/60",
                invalid("address")
                  ? "border-ink"
                  : "border-hairline focus:border-ink",
              )}
            />
          </label>
        </fieldset>

        <fieldset className="mt-9">
          <legend className="t-meta mb-3 text-ink-dim">Payment</legend>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m.id}
                className={cn(
                  "t-label flex h-12 cursor-pointer items-center justify-center border text-center text-sm transition-colors duration-150",
                  payment === m.id
                    ? "border-ink bg-ink text-surface"
                    : "border-hairline hover:border-ink",
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.id}
                  checked={payment === m.id}
                  onChange={() => setPayment(m.id)}
                  className="sr-only"
                />
                {m.id === "cash" ? "Cash" : m.label}
              </label>
            ))}
          </div>
          <p className="t-meta mt-2 normal-case text-ink-mid">
            {PAYMENT_METHODS.find((m) => m.id === payment)?.note}
          </p>
        </fieldset>

        <div className="mt-9">
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Best time to call, gate code…"
          />
        </div>
      </div>

      <div className="border-t border-hairline px-5 py-5">
        <Row label="Subtotal" value={formatPrice(subtotal)} />
        <Row
          label="Delivery"
          value={
            delivery === null
              ? "Pick an area"
              : delivery === 0
                ? "Free"
                : formatPrice(delivery)
          }
          dim={delivery === null}
        />
        <div className="mt-2 mb-4 flex justify-between border-t border-hairline pt-3">
          <p className="t-label">Total</p>
          <p className="t-label tabular-nums">{formatPrice(total)}</p>
        </div>

        <p className="t-meta mb-3 text-ink-dim">
          Arrives in {DELIVERY_DAYS.from}–{DELIVERY_DAYS.to} days · never more
          than {DELIVERY_DAYS.latest}
        </p>

        {error && (
          <p role="alert" className="t-meta mb-3 text-ink">
            {error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="gradient-fill-deep t-label flex h-14 w-full items-center justify-center transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Placing order…" : `Place order · ${formatPrice(total)}`}
        </button>
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  invalid,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="t-meta text-ink-dim">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "t-body h-11 w-full rounded-none border-b bg-transparent text-base outline-none placeholder:text-ink-dim/60",
          invalid ? "border-ink" : "border-hairline focus:border-ink",
        )}
      />
    </label>
  );
}

function Row({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div className="mb-1 flex justify-between">
      <p className="t-meta text-ink-dim">{label}</p>
      <p
        className={cn("t-meta tabular-nums", dim ? "text-ink-dim" : "text-ink")}
      >
        {value}
      </p>
    </div>
  );
}
