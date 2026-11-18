import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/commerce";

/**
 * One continuous grid. No "editorial section" separated from a "shop
 * section".
 *
 * Uniform 9:12 for now: the double-width rhythm needs a dedicated wide shot
 * per featured product, because cropping a portrait hanging-shirt photo to
 * landscape loses the hanger and the hem. Add `col-span-2` back here the
 * day those shots exist.
 */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <section className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-16">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </section>
  );
}
