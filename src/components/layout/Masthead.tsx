import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { PerksStrip } from "@/components/shop/Perks";
import type { Season } from "@/lib/seasons";

/**
 * Width-driven with a max, not height-driven — a 2:1 wordmark sized off
 * viewport height changed composition from screen to screen. On a phone it
 * takes under half the width, so the first screen reaches the shirts.
 *
 * Order follows what a buyer needs: where to shop, then the reassurance
 * that answers "will it reach me, what does it cost, what's in the box",
 * and only then the brand line — quiet, never louder than a way in.
 */
export function Masthead({ season }: { season: Season }) {
  const shop = [
    { label: "Best sellers", href: "#best-sellers" },
    { label: "Champions League", href: "#champions-league" },
    { label: "Leagues", href: "#leagues" },
    { label: "Teams", href: "#teams" },
    { label: "National teams", href: "#national-teams" },
    { label: "Categories", href: "#categories" },
    { label: "Size guide", href: "/size-guide" },
    { label: "About", href: "/about" },
  ];

  return (
    <header className="px-4 pt-20 lg:px-6 lg:pt-28">
      <Logo className="w-[42%] max-w-[34rem] text-ink md:w-full lg:max-w-[38rem]" />
      <span className="sr-only">93+</span>

      <div className="gradient-fill mt-4 mb-4 h-[4px] w-full lg:mt-6 lg:mb-6 lg:h-[5px]" />

      <div id="season-mark" className="pb-10 lg:pb-16">
        {/* Boxed, so they read as buttons on a phone — as plain words they
            looked like a caption. One swipeable row rather than three
            wrapped lines, so the block is no taller than before. */}
        <nav aria-label="Shop" className="-mx-4 lg:mx-0">
          <ul className="scrollbar-hidden flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:flex-wrap lg:overflow-visible lg:px-0 lg:[mask-image:none]">
            {shop.map((item) => {
              const anchor = item.href.startsWith("#");
              const className =
                "t-label inline-flex h-10 items-center gap-1.5 border border-ink px-3.5 whitespace-nowrap transition-colors duration-150 hover:bg-ink hover:text-ground active:bg-ink active:text-ground";
              return (
                <li key={item.href} className="shrink-0">
                  {anchor ? (
                    <a href={item.href} className={className}>
                      {item.label}
                      <svg viewBox="0 0 10 10" aria-hidden className="h-2.5 w-2.5">
                        <path d="M5 0v8.5M1.5 5 5 8.5 8.5 5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                    </a>
                  ) : (
                    <Link href={item.href} className={className}>
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <PerksStrip className="mt-5" />

        <p className="t-meta mt-4 text-ink-dim">
          {season.name} — Ninety minutes is a suggestion.
        </p>
      </div>
    </header>
  );
}
