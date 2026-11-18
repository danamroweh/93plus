import { Rail } from "./Rail";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/commerce/types";

/**
 * Cross-sell at the foot of the product page.
 *
 * Labelled "Complete the kit" rather than "customers who bought this also
 * bought". The second phrasing is honest only once there's purchase data to
 * derive it from — on a new store it's a claim about behaviour that hasn't
 * happened yet, and this brand can't afford small untruths. "Complete the
 * kit" makes the same suggestion as an editorial one, needs no data, and
 * sounds like the shop rather than the platform.
 *
 * Accessories lead deliberately. They're the cheap add-on that clears the
 * free-delivery threshold on a $25 shirt, which is the one cross-sell that
 * pays for itself twice.
 */
export function CompleteTheKit({
  products,
  currentHandle,
}: {
  products: Product[];
  currentHandle: string;
}) {
  const current = products.find((p) => p.handle === currentHandle);
  const pool = products.filter((p) => p.handle !== currentHandle);
  // Same club first — a Madrid shirt suggests the Madrid mug, not Messi's.
  const shared = (p: Product) =>
    p.collections?.some((c) => current?.collections?.includes(c)) ? 0 : 1;
  const accessories = pool
    .filter((p) => !p.customisable)
    .sort((a, b) => shared(a) - shared(b));
  const shirts = pool.filter((p) => p.customisable);
  const picks = [...accessories, ...shirts].slice(0, 8);

  if (!picks.length) return null;

  return (
    <section className="px-4 pb-24 lg:px-6 lg:pb-32">
      <Rail label="Complete the kit" aside={`${picks.length}`}>
        {picks.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            className="w-[46vw] shrink-0 sm:w-[240px]"
          />
        ))}
      </Rail>
    </section>
  );
}
