import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { OrderLookup } from "@/components/order/OrderLookup";
import { BackLink } from "@/components/ui/Buttons";

export const metadata: Metadata = { title: "Track an order" };

/**
 * "Where is my order", answered without a WhatsApp message. The order number
 * plus the last four digits of the phone it was placed with unlock the
 * status line from the order sheet. Nothing personal comes back — the page
 * only ever shows status, items and total.
 */
export default function OrderPage() {
  return (
    <>
      <Header />
      <main id="page">
        <div className="px-4 pt-24 lg:px-6 lg:pt-32">
          <BackLink className="mb-6" />
          <h1 className="t-display mb-5 text-[clamp(2.5rem,9vw,6rem)]">
            Track an order
          </h1>
          <div className="gradient-fill mb-6 h-[5px] w-full" />
          <p className="t-label mb-10 max-w-xl">
            Your order number and the last four digits of the phone you ordered with.
          </p>
          <OrderLookup />
        </div>
        <Footer />
      </main>
    </>
  );
}
