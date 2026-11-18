import Link from "next/link";
import type { Collection } from "@/lib/commerce/types";
import { cn } from "@/lib/utils";
import { ProductPhoto } from "./ProductPhoto";

/**
 * Teams and categories share one component but take different shapes, and
 * that difference is the page's rhythm.
 *
 * Teams are narrow and square — six or seven in view, so the rail reads as
 * a list you scan. Categories are wide and landscape — two and a half in
 * view, so it reads as a set of destinations. Three different cadences
 * across the page (4-up grid, tight rail, wide rail) without resorting to
 * an irregular grid.
 */
export function CollectionTile({
  collection,
  className,
}: {
  collection: Collection;
  /** Overrides the rail width — `w-full` when the tile sits in a grid. */
  className?: string;
}) {
  const isTeam = collection.kind === "team";

  return (
    <Link
      href={`/collection/${collection.handle}`}
      data-cursor="text"
      className={cn(
        "group block shrink-0 snap-start",
        isTeam ? "w-[42vw] sm:w-[190px]" : "w-[78vw] sm:w-[360px]",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-panel",
          isTeam ? "aspect-square" : "aspect-[4/3]",
        )}
      >
        <ProductPhoto
          image={
            // Always the cold face — a rail of gradient tiles would spend
            // the brand colour everywhere at once.
            collection.image.placeholder
              ? {
                  ...collection.image,
                  alt: collection.title,
                  placeholder: "front",
                }
              : collection.image
          }
          alt={collection.title}
          sizes={isTeam ? "190px" : "360px"}
          draggable={false}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 [background:radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]"
        />
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <p className="t-title">{collection.title}</p>
        <p className="t-meta shrink-0 text-ink-dim tabular-nums">
          {collection.count}
        </p>
      </div>
    </Link>
  );
}
