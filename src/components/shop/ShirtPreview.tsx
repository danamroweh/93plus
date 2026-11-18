import type { PrintPlacement, ProductImage } from "@/lib/commerce/types";
import { cn } from "@/lib/utils";
import { ProductPhoto } from "./ProductPhoto";

/**
 * Print colour, deliberately not the brand red.
 *
 * The lettering belongs to the kit, not to the shop — most white shirts
 * print navy or near-black. It sits at 62% and multiplies, so the fabric's
 * folds and shadows show through it the way heat-pressed vinyl actually
 * behaves. At full strength it read as a sticker laid on the photo.
 *
 * Per-product once Shopify is wired — this belongs in a metafield beside
 * the placement values below.
 */
export const PRINT_COLOUR = "rgba(18, 20, 26, 0.62)";

/**
 * Where the print sits, in container-query units so it scales with the
 * image at any size. These match the placeholder artwork; real photography
 * needs them per product, since every kit prints in a slightly different
 * place — those come in as `product.print`.
 */
export const DEFAULT_PRINT: PrintPlacement = {
  nameTop: 34.5, // % of height
  nameSize: 3.8, // cqw
  numberTop: 41.5,
  numberSize: 23,
};

/**
 * The conversion moment.
 *
 * When someone types a name, this replaces the main gallery image — not a
 * thumbnail, not a side panel. The big picture becomes *their* shirt. It's
 * the reason the back photo has to be flat, straight-on and centred.
 */

export function ShirtPreview({
  back,
  name,
  number,
  className,
  print = DEFAULT_PRINT,
}: {
  back: ProductImage;
  name: string;
  number: string;
  className?: string;
  print?: PrintPlacement;
}) {
  // A hanging shirt rarely lands dead-centre; the print follows its spine.
  const shift = print.centre ? `translateX(${print.centre - 50}cqw)` : undefined;

  return (
    <div className={cn("relative overflow-hidden bg-panel @container", className)}>
      <ProductPhoto
        image={back}
        alt="Shirt back with your name and number"
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="object-cover"
      />

      {/* Jersey numerals are never the brand font — every kit has its own
          bespoke squared face, so a separate condensed display type reads
          as correct here rather than sloppy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 font-[family-name:var(--font-jersey)] uppercase"
        style={{
          color: print.lightInk ?? PRINT_COLOUR,
          mixBlendMode: (print.blend ??
            (print.lightInk ? "normal" : "multiply")) as React.CSSProperties["mixBlendMode"],
          transform: shift,
        }}
      >
        {name && (
          <div
            className="absolute inset-x-0 text-center leading-none tracking-[0.08em]"
            style={{ top: `${print.nameTop}%`, fontSize: `${print.nameSize}cqw` }}
          >
            {name}
          </div>
        )}
        {number && (
          <div
            className="absolute inset-x-0 text-center leading-none"
            style={{
              top: `${print.numberTop}%`,
              fontSize: `${print.numberSize}cqw`,
            }}
          >
            {number}
          </div>
        )}
      </div>
    </div>
  );
}
