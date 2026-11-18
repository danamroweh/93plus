import Link from "next/link";
import { ChipLink } from "@/components/ui/Buttons";
import { FREE_SHIPPING_CENTS } from "@/lib/commerce/types";
import { DELIVERY_DAYS, INSTAGRAM_URL, whatsappLink } from "@/lib/contact";
import { formatPrice } from "@/lib/utils";

/**
 * Three links that answer the three questions which stop a purchase —
 * will it ship to me, can I send it back, what size am I. Each opens a
 * drawer, never a page. This is how "no long pages" and "buyers need
 * information" coexist.
 */
export function UtilityRow() {
  const items = [
    {
      label: `Free delivery over ${formatPrice(FREE_SHIPPING_CENTS)} · ${DELIVERY_DAYS.from}–${DELIVERY_DAYS.to} days`,
      href: "/shipping",
    },
    { label: "30-day returns", href: "/returns" },
    { label: "Size guide", href: "/size-guide" },
    { label: "About us", href: "/about" },
  ];

  return (
    <section className="mt-24 border-t border-hairline px-4 py-6 lg:px-6">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <ChipLink href={item.href}>{item.label}</ChipLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 px-4 pb-10 lg:px-6">
      <div className="gradient-fill mb-8 h-[5px] w-full" />

      {/* A sign-off, not a headline — kept small so it never competes with
          anything you can actually buy. */}
      <div className="mb-14 flex items-end justify-between gap-6 lg:mb-20">
        <p className="t-statement text-2xl md:text-[2.5vw]">
          Nothing&rsquo;s decided.
          <br />
          <span className="text-ink-mid">That&rsquo;s the point.</span>
        </p>
        <p className="t-statement shrink-0 text-5xl leading-[0.8] md:text-[5vw]">
          ©26
        </p>
      </div>

      <div className="grid grid-cols-8 gap-x-6 gap-y-12 md:grid-cols-16">
        <div className="order-last col-span-8 md:order-first md:col-span-4">
          <p className="t-meta text-ink-dim">
            93+ — All rights reserved © 2026
          </p>
        </div>

        <div className="col-span-4 md:col-span-3">
          <ul className="t-meta flex flex-col gap-3">
            <li>
              <Link href="/shipping" className="link-hover">
                Shipping
              </Link>
            </li>
            <li>
              <Link href="/returns" className="link-hover">
                Returns
              </Link>
            </li>
            <li>
              <Link href="/size-guide" className="link-hover">
                Size guide
              </Link>
            </li>
            <li>
              <Link href="/about" className="link-hover">
                About us
              </Link>
            </li>
          </ul>
        </div>

        <div className="col-span-4 md:col-span-3">
          <ul className="t-meta flex flex-col gap-3">
            <li>
              <Link href="/privacy" className="link-hover">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="link-hover">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/order" className="link-hover">
                Track order
              </Link>
            </li>
          </ul>
        </div>

        <div className="order-first col-span-8 md:order-last md:col-span-6 md:justify-self-end">
          <ul className="t-meta flex gap-8">
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="link-hover"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="link-hover"
              >
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
