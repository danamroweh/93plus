import { Sparkle } from "@/components/ui/Logo";
import { PhotoLink } from "./PhotoLink";
import { ProductPhoto } from "./ProductPhoto";
import { QuickAdd } from "./QuickAdd";
import type { Product } from "@/lib/commerce";
import { hoverOf, type ProductImage } from "@/lib/commerce/types";
import { cn, formatPrice } from "@/lib/utils";

/** A 1×1 transparent GIF — what a phone gets in place of the hot frame. */
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * The hot frame only ever shows on hover, and a phone can't hover. A
 * <picture> with a hover media query hands the real file to mouse devices
 * and a blank pixel to touch screens; the browser decides, no JavaScript.
 * It also keeps the file off the phone's lazy-load queue entirely.
 */
function HoverFrame({
  image,
  caption,
  eager,
  className,
}: {
  image: ProductImage;
  caption?: string;
  /** First row: fetched up front on mouse devices, so the first hover doesn't flash. */
  eager?: boolean;
  className?: string;
}) {
  if (image.placeholder)
    return (
      <ProductPhoto
        data-image="back"
        image={image}
        caption={caption}
        alt=""
        className={className}
      />
    );
  return (
    <picture>
      <source
        media="(hover: hover) and (pointer: fine)"
        srcSet={image.srcSet ?? image.url}
        sizes="(min-width: 1024px) 25vw, 50vw"
      />
      <img
        src={BLANK}
        alt=""
        data-image="back"
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("absolute inset-0 h-full w-full", className)}
      />
    </picture>
  );
}

/**
 * Cold frame → hot frame on hover.
 *
 * The two shots are the same shirt in the same position under a different
 * light, so the hover is a temperature change, not a second photograph.
 * Three things move together: the hot frame swipes in left to right, the
 * whole frame zooms very slightly, and the vignette deepens.
 *
 * Hover only. On touch the card stays cold — the hot frame is the hover's
 * colour and appears nowhere else, the product page included.
 */
export function ProductCard({
  product,
  priority = false,
  className,
}: {
  product: Product;
  priority?: boolean;
  className?: string;
}) {
  const front = product.images[0];
  const back = hoverOf(product.images);
  // The quick-add button adds Fan, Blank (or the preset) in a size. It gets
  // those variants and the front photo, not the whole product — on a full
  // collection page the difference is ~150 KB of HTML.
  const custom = product.customisable && product.preset ? "Name + Number" : "Blank";
  const quick: Product = {
    ...product,
    description: "",
    images: [front],
    variants: product.variants.filter(
      (v) =>
        (!v.options.Version || v.options.Version === "Fan") &&
        (!v.options.Customisation || v.options.Customisation === custom),
    ),
  };
  const price = formatPrice(
    product.priceRange.min.cents,
    product.priceRange.min.currency,
  );
  const hasRange =
    product.priceRange.min.cents !== product.priceRange.max.cents;

  // Every cell is 9:12 for now. A double-width cell needs its own wide shot
  // — cropping a hanging-shirt portrait to landscape throws away the hanger
  // and the hem and reads as an accident rather than a hero.

  return (
    <div data-product className={cn("group relative", className)}>
      <PhotoLink
        href={`/product/${product.handle}`}
        data-cursor="text"
        className="block"
      >
        <div className="relative aspect-shirt w-full overflow-hidden bg-panel">
          {/* One transform for both frames.
            The two shots are the same shirt in the same position, so scaling
            them individually would slide them out of register and turn a
            light change into two different photographs. Zooming the wrapper
            instead keeps them locked and pushes the whole frame in while the
            swipe crosses it. Slower than the swipe on purpose — the move
            carries on after the colour has landed, which is what makes it
            read as filmic rather than as a toggle. */}
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.06]">
            <ProductPhoto
              data-image="front"
              image={front}
              caption={product.category}
              alt={product.title}
              sizes="(min-width: 1024px) 25vw, 50vw"
              preload={priority}
              fetchPriority={priority ? "high" : undefined}
              draggable={false}
              className="object-cover"
            />

            {/* The hot frame swipes in left to right. Only clip-path moves —
              the shirt underneath never shifts, so the swipe reads as light
              crossing the shot rather than as a second photograph arriving. */}
            {back && (
              <HoverFrame
                image={back}
                caption={product.category}
                eager={priority}
                className={cn(
                  "object-cover",
                  "transition-[clip-path] duration-500 ease-[cubic-bezier(0.87,0,0.13,1)]",
                  "[clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0_0_0_0)]",
                )}
              />
            )}
          </div>

          {/* Hover only. At rest the shot is completely clean; the vignette
            arrives with the hot frame and pulls the corners down, so the
            heat reads as a light source rather than a flat colour swap.
            Timed to the swipe, not the zoom. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out",
              "[background:radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]",
              "opacity-0 group-hover:opacity-100",
            )}
          />

          {/* Scroll-in cover. Inline transform rather than a Tailwind class so
            GSAP owns it outright — Tailwind v4 writes `translate`, GSAP writes
            `transform`, and having both on one element fights. Starts parked
            off-frame so the card is correct before JS runs. */}
          <div
            data-reveal-panel
            aria-hidden
            style={{ transform: "translateX(100%)" }}
            className="absolute inset-0 bg-panel"
          />

          {!product.available && (
            <span className="t-meta absolute top-3 left-3 bg-ground/80 px-2 py-1">
              Sold out
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-0.5">
          <p className="t-title">{product.title}</p>
          <p className="t-title tabular-nums text-ink-mid">
            {hasRange ? `From ${price}` : price}
          </p>
        </div>

        {/* A shirt is a full set — said on the card, because people kept
            asking whether the shorts come with it. */}
        <p
          className={cn(
            "t-meta mt-1.5 flex items-center gap-1.5",
            product.set ? "text-ink" : "text-ink-dim",
          )}
        >
          <Sparkle className="h-2 w-2 shrink-0" />
          {product.set ? `Full set · ${product.set}` : product.category}
        </p>
      </PhotoLink>

      {/* Overlays the image box only — same aspect as the frame above. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-shirt @container">
        <QuickAdd product={quick} />
      </div>
    </div>
  );
}
