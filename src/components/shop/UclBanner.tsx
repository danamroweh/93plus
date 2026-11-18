import Link from "next/link";
import { Sparkle } from "@/components/ui/Logo";
import { Arrow } from "@/components/ui/Buttons";
import { UCL } from "@/lib/commerce/catalogue";

/**
 * Champions League kits get their own door on the homepage. It's the one
 * place the site goes European-Nights blue whatever the season — the colour
 * of those nights is the point. Before the first UCL kit is in stock it
 * still opens: the page takes requests on WhatsApp.
 */
export function UclBanner({ count }: { count: number }) {
  return (
    <Link
      href={`/collection/${UCL.handle}`}
      className="gradient-ucl group relative flex min-h-[15rem] flex-col justify-between overflow-hidden p-5 text-white lg:min-h-[20rem] lg:p-8"
    >
      {/* Four sparkles for the stars — the mark, not the trophy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25">
        <Sparkle className="absolute top-[10%] right-[6%] h-16 w-16 transition-transform duration-700 group-hover:rotate-90 lg:h-24 lg:w-24" />
        <Sparkle className="absolute top-[38%] right-[4%] h-6 w-6 lg:right-[22%] lg:h-10 lg:w-10" />
        <Sparkle className="absolute right-[5%] bottom-[8%] h-9 w-9 lg:h-14 lg:w-14" />
        <Sparkle className="absolute top-[18%] right-[30%] hidden h-4 w-4 lg:block" />
      </div>

      <p className="t-meta relative opacity-80">European nights</p>

      <div className="relative">
        <p className="t-display text-[clamp(2.4rem,9vw,6rem)]">{UCL.title}</p>
        <p className="t-label mt-3 max-w-[34ch] opacity-90">
          {count > 0
            ? `${count} UCL ${count === 1 ? "kit" : "kits"} in stock — full sets, name and number printing.`
            : "UCL kits are landing soon. Reserve yours now — we'll hold one in your size."}
        </p>
        <span className="t-label mt-5 inline-flex h-11 items-center gap-2 bg-white px-4 text-[#101c6b] transition-transform duration-200 group-hover:translate-x-1">
          {count > 0 ? "Shop UCL kits" : "Reserve a UCL kit"}
          <Arrow />
        </span>
      </div>
    </Link>
  );
}
