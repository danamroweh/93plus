import Link from "next/link";
import { Sparkle } from "@/components/ui/Logo";
import { CartButton } from "@/components/cart/CartButton";
import { SearchButton } from "@/components/search/Search";

/**
 * mix-blend-difference means the header inverts itself against whatever
 * scrolls beneath it, so it never needs a background — the single most
 * load-bearing trick borrowed from OUTFIT.
 */
export function Header() {
  return (
    <nav
      id="header"
      className="blend-difference fixed top-0 left-0 z-30 flex w-full items-center justify-between text-header-invert"
    >
      <div className="flex w-full items-center justify-between px-4 py-6 lg:px-6 lg:py-8">
        <Link href="/" aria-label="93+ home" className="shrink-0">
          <Sparkle className="h-5 w-5 lg:h-6 lg:w-6" />
        </Link>

        <ul className="flex items-center gap-6 text-lg font-medium tracking-tight md:gap-12 md:text-2xl">
          <li>
            <SearchButton />
          </li>
          <li>
            <CartButton />
          </li>
        </ul>
      </div>
    </nav>
  );
}
