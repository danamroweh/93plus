import Image from "next/image";
import { LocalPhoto } from "./LocalPhoto";
import { PATH_SPARKLE, SPARKLE_VIEWBOX } from "@/components/ui/Logo";
import type { ProductImage } from "@/lib/commerce/types";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Image>, "src" | "alt"> & {
  image: ProductImage;
  alt?: string;
  /** Small line above the name on a placeholder — "Mug", "Retro shirt". */
  caption?: string;
  "data-image"?: string;
};

/**
 * A product photo, or — until the photo exists — a typeset stand-in.
 *
 * The stand-in follows the photo pair's logic: the front is the cold frame
 * (panel beige, the name in brand red), the back is the hot frame (the deep
 * gradient, which is the card-hover flash the brand already allows). So the
 * hover swipe still reads as light changing, and a grid with no photos
 * looks typeset on purpose rather than broken.
 *
 * Always `fill` — every call site sizes the box itself.
 */
export function ProductPhoto({
  image,
  alt = "",
  caption,
  className,
  ...rest
}: Props) {
  // Our own photos carry a srcset of phone sizes; LocalPhoto serves those.
  if (!image.placeholder && image.url.startsWith("/")) {
    return (
      <LocalPhoto
        image={image}
        alt={alt}
        sizes={rest.sizes}
        preload={rest.preload}
        fetchPriority={rest.fetchPriority}
        draggable={rest.draggable}
        data-image={rest["data-image"]}
        className={className}
      />
    );
  }

  if (!image.placeholder) {
    return (
      <Image
        src={image.url}
        alt={alt}
        fill
        // Our own photos are already 864px WebP at ~60KB — the size this
        // grid wants. Sending them through the optimiser made the first view
        // of every frame wait on a server-side re-encode. Shopify's CDN
        // images still go through it.
        unoptimized={image.url.startsWith("/")}
        // A 16px blurred copy inlined in the HTML, so the frame shows its
        // colours at once instead of an empty box.
        placeholder={image.blur ? "blur" : "empty"}
        blurDataURL={image.blur}
        className={className}
        {...rest}
      />
    );
  }

  const hot = image.placeholder === "back";
  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-image={rest["data-image"]}
      className={cn(
        "absolute inset-0 flex flex-col justify-between p-[7%] @container",
        hot ? "gradient-fill-deep text-ground" : "bg-panel text-ink",
        className,
      )}
    >
      {/* Name up top, caption bottom-left — the bottom-right corner belongs
          to the quick-add button. Text is too small to read in a cart
          thumbnail, so below 120px the sparkle carries it alone. */}
      <div>
        <svg
          viewBox={SPARKLE_VIEWBOX}
          fill="currentColor"
          aria-hidden
          className="mb-[8cqw] w-[11cqw]"
        >
          <path d={PATH_SPARKLE} />
        </svg>
        <p className="t-display hidden text-[10.5cqw] break-words @min-[120px]:block">
          {image.alt}
        </p>
      </div>
      {caption && (
        <p className="t-meta hidden opacity-70 @min-[120px]:block">{caption}</p>
      )}
    </div>
  );
}
