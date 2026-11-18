import { Header } from "@/components/layout/Header";
import { Masthead } from "@/components/layout/Masthead";
import { Footer, UtilityRow } from "@/components/layout/Footer";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { GridReveal } from "@/components/shop/GridReveal";
import { SectionHeader } from "@/components/shop/Section";
import { Rail } from "@/components/shop/Rail";
import { CollectionTile } from "@/components/shop/CollectionTile";
import { LeagueTile } from "@/components/shop/LeagueTile";
import { UclBanner } from "@/components/shop/UclBanner";
import { ChipLink, Arrow } from "@/components/ui/Buttons";
import { SeasonSync } from "@/components/season/SeasonSync";
import {
  getBestSellers,
  getCollectionProducts,
  getCollections,
  getLeagues,
} from "@/lib/commerce";
import { UCL } from "@/lib/commerce/catalogue";
import { DELIVERY_DAYS } from "@/lib/contact";
import type { Season } from "@/lib/seasons";

/**
 * The homepage, as a component so two routes can render it: `/` with the
 * calendar's season, and `/season/<id>` to preview any other. Keeping
 * `/` free of search params is what lets it be built once and served from
 * the CDN rather than rendered for every visitor.
 */
export async function HomeScreen({ season }: { season: Season }) {
  const [bestSellers, ucl, allLeagues, allTeams, categories] = await Promise.all([
    getBestSellers(),
    getCollectionProducts(UCL.handle),
    getLeagues(),
    getCollections("team"),
    getCollections("category"),
  ]);
  // Countries get their own rail; the Teams and Leagues rails are clubs.
  const nationHandles = new Set(
    allLeagues.find((l) => l.handle === "national-teams")?.teams.map((t) => t.handle),
  );
  const isNation = (handle: string) => nationHandles.has(handle);
  const teams = allTeams.filter((t) => !isNation(t.handle));
  const nations = allTeams.filter((t) => isNation(t.handle));
  const leagues = allLeagues.filter((l) => l.handle !== "national-teams");

  return (
    <>
      <SeasonSync season={season.id} />
      <Header />
      <main id="page">
        <Masthead season={season} />

        <div className="px-4 lg:px-6">
          <section id="best-sellers" className="mb-20 scroll-mt-20 lg:mb-28">
            <SectionHeader
              label="Best sellers"
              aside={String(bestSellers.length).padStart(2, "0")}
            />
            <GridReveal>
              <ProductGrid products={bestSellers} />
            </GridReveal>
          </section>

          <section id="champions-league" className="mb-20 scroll-mt-20 lg:mb-28">
            <SectionHeader label="Champions League" />
            <UclBanner count={ucl.length} />
          </section>

          <section id="leagues" className="mb-20 scroll-mt-20 lg:mb-28">
            <Rail label="Leagues" aside={`${leagues.length}`}>
              {leagues.map((league) => (
                <LeagueTile key={league.handle} league={league} />
              ))}
            </Rail>
          </section>

          <section id="teams" className="mb-20 scroll-mt-20 lg:mb-28">
            <Rail label="Teams" aside={`${teams.length}`}>
              {teams.map((team) => (
                <CollectionTile key={team.handle} collection={team} />
              ))}
            </Rail>
          </section>

          {nations.length > 0 && (
            <section id="national-teams" className="mb-20 scroll-mt-20 lg:mb-28">
              <Rail label="National teams" aside={`${nations.length}`}>
                {nations.map((team) => (
                  <CollectionTile key={team.handle} collection={team} />
                ))}
              </Rail>
            </section>
          )}

          <section id="categories" className="mb-20 scroll-mt-20 lg:mb-28">
            <Rail label="Categories" aside={`${categories.length}`}>
              {categories.map((category) => (
                <CollectionTile key={category.handle} collection={category} />
              ))}
            </Rail>
          </section>

          <section id="about" className="scroll-mt-20">
            <SectionHeader label="About 93+" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <p className="t-title max-w-[40ch] text-2xl leading-snug lg:text-3xl">
                A football shirt shop in Lebanon. Full sets, printed with any
                name and number, at your door in{" "}
                <span className="whitespace-nowrap">
                  {DELIVERY_DAYS.from}–{DELIVERY_DAYS.to} days.
                </span>
              </p>
              <ChipLink href="/about" className="self-start lg:self-auto">
                Our story
                <Arrow />
              </ChipLink>
            </div>
          </section>
        </div>

        <UtilityRow />
        <Footer />
      </main>
    </>
  );
}
