import { Sparkle } from "@/components/ui/Logo";
import { FREE_SHIPPING_CENTS } from "@/lib/commerce/types";
import { DELIVERY_DAYS } from "@/lib/contact";
import { cn, formatPrice } from "@/lib/utils";

/**
 * The four answers people asked for before buying: will delivery cost me,
 * when does it come, what's in the box, how do I pay. Stated up front — on
 * the homepage, every collection and every product — instead of on a policy
 * page nobody opens.
 */
const PERKS = [
  {
    title: `Free delivery over ${formatPrice(FREE_SHIPPING_CENTS)}`,
    note: "Anywhere in Lebanon",
  },
  {
    title: `Arrives in ${DELIVERY_DAYS.from}–${DELIVERY_DAYS.to} days`,
    note: `Never more than ${DELIVERY_DAYS.latest}`,
  },
  { title: "Every shirt is a full set", note: "Shirt + shorts" },
  { title: "Pay cash at the door", note: "Or Whish / OMT" },
];

/** Solid band — homepage and collections. Two by two on a phone. */
export function PerksStrip({ className }: { className?: string }) {
  return (
    <ul
      // The 1px gaps let the page show through as dividers.
      className={cn(
        "grid grid-cols-2 gap-px border border-ink text-ground lg:grid-cols-4",
        className,
      )}
    >
      {PERKS.map((perk) => (
        <li key={perk.title} className="flex gap-2.5 bg-ink px-3 py-3 lg:px-4 lg:py-4">
          <Sparkle className="mt-0.5 h-3 w-3 shrink-0" />
          <div>
            <p className="t-label leading-tight">{perk.title}</p>
            <p className="t-meta mt-1 opacity-75">{perk.note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Quieter list under the add-to-cart button, free delivery first. */
export function PerksList({ hideSet }: { hideSet?: boolean }) {
  return (
    <ul className="flex flex-col border-t border-hairline">
      {PERKS.filter((p) => !hideSet || !p.title.includes("full set")).map(
        (perk, i) => (
          <li
            key={perk.title}
            className="flex items-baseline justify-between gap-4 border-b border-hairline py-3"
          >
            <p className={cn("t-label flex items-center gap-2", i === 0 && "[color:var(--g-1)]")}>
              <Sparkle className="h-2.5 w-2.5 shrink-0" />
              {perk.title}
            </p>
            <p className="t-meta shrink-0 text-ink-dim">{perk.note}</p>
          </li>
        ),
      )}
    </ul>
  );
}
