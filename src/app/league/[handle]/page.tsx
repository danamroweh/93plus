import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer, UtilityRow } from "@/components/layout/Footer";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { GridReveal } from "@/components/shop/GridReveal";
import { SectionHeader } from "@/components/shop/Section";
import { CollectionTile } from "@/components/shop/CollectionTile";
import { PerksStrip } from "@/components/shop/Perks";
import { BackLink } from "@/components/ui/Buttons";
import { getCollectionProducts, getLeagues } from "@/lib/commerce";

async function findLeague(handle: string) {
  return (await getLeagues()).find((l) => l.handle === handle) ?? null;
}

export async function generateStaticParams() {
  return (await getLeagues()).map((l) => ({ handle: l.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return { title: (await findLeague(handle))?.title ?? "Not found" };
}

/**
 * A league page is a list of its clubs, most famous first — the way people
 * actually look for a shirt — and below them every kit from the league in
 * that same club order.
 */
export default async function LeaguePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const league = await findLeague(handle);
  if (!league) notFound();

  const byTeam = await Promise.all(
    league.teams.map((t) => getCollectionProducts(t.handle)),
  );
  // Shirts first within the league, then the club's accessories.
  const products = [
    ...new Map(
      [...byTeam.flat().filter((p) => p.customisable), ...byTeam.flat()].map(
        (p) => [p.handle, p],
      ),
    ).values(),
  ];

  return (
    <>
      <Header />
      <main id="page">
        <div className="px-4 pt-24 lg:px-6 lg:pt-32">
          <BackLink className="mb-6" />
          <h1 className="t-display mb-5 text-[clamp(2.5rem,9vw,6rem)]">
            {league.title}
          </h1>
          <div className="gradient-fill mb-8 h-[5px] w-full" />

          <SectionHeader label="Teams" aside={`${league.teams.length}`} />
          <div className="mb-16 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:mb-24 lg:grid-cols-6 lg:gap-x-6">
            {league.teams.map((team) => (
              <CollectionTile key={team.handle} collection={team} className="w-full sm:w-full" />
            ))}
          </div>

          <SectionHeader label={`All ${league.title} kits`} aside={`${products.length}`} />
          <GridReveal>
            <ProductGrid products={products} />
          </GridReveal>

          <PerksStrip className="mt-20" />
        </div>
        <UtilityRow />
        <Footer />
      </main>
    </>
  );
}
