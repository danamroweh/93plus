import Link from "next/link";
import type { League } from "@/lib/commerce/types";
import { ProductPhoto } from "./ProductPhoto";

/**
 * A league is a way in, not a product — so the tile is typeset, with the
 * league's clubs standing along the bottom as their newest shirts, most
 * famous first. Same width as a category tile, so the rails keep one rhythm.
 */
export function LeagueTile({ league }: { league: League }) {
  const clubs = league.teams.slice(0, 3);
  const n = league.teams.length;

  return (
    <Link
      href={`/league/${league.handle}`}
      data-cursor="text"
      className="group block w-[78vw] shrink-0 sm:w-[360px]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-panel">
        <p className="t-display absolute top-4 left-4 z-10 text-[2.25rem] leading-none lg:text-[2.6rem]">
          {league.title}
        </p>
        <div className="absolute inset-x-0 bottom-0 flex h-[64%] items-end justify-center gap-2 px-4">
          {clubs.map((team) => (
            <div
              key={team.handle}
              className="relative aspect-shirt h-full overflow-hidden transition-transform duration-500 ease-out group-hover:-translate-y-1.5"
            >
              <ProductPhoto
                image={team.image}
                alt={team.title}
                sizes="140px"
                draggable={false}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <p className="t-title truncate">
          {league.teams.map((t) => t.title).join(" · ")}
        </p>
        <p className="t-meta shrink-0 text-ink-dim tabular-nums">
          {n} {n === 1 ? "team" : "teams"}
        </p>
      </div>
    </Link>
  );
}
