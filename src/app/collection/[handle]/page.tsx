import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer, UtilityRow } from "@/components/layout/Footer";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { GridReveal } from "@/components/shop/GridReveal";
import { SectionHeader } from "@/components/shop/Section";
import { PerksStrip } from "@/components/shop/Perks";
import { Arrow, BackLink } from "@/components/ui/Buttons";
import { getCollectionProducts, getCollections } from "@/lib/commerce";
import { UCL } from "@/lib/commerce/catalogue";
import { placeholderImages, type Collection } from "@/lib/commerce/types";
import { whatsappLink } from "@/lib/contact";

/** Champions League stays open while it's empty — it takes requests. */
const UCL_EMPTY: Collection = {
  handle: UCL.handle,
  title: UCL.title,
  kind: "category",
  image: placeholderImages(UCL.title)[0],
  count: 0,
};

async function findCollection(handle: string) {
  const [teams, categories] = await Promise.all([
    getCollections("team"),
    getCollections("category"),
  ]);
  return (
    [...teams, ...categories].find((c) => c.handle === handle) ??
    (handle === UCL.handle ? UCL_EMPTY : null)
  );
}

export async function generateStaticParams() {
  const [teams, categories] = await Promise.all([
    getCollections("team"),
    getCollections("category"),
  ]);
  const handles = new Set([...teams, ...categories].map((c) => c.handle));
  handles.add(UCL.handle);
  return [...handles].map((handle) => ({ handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const collection = await findCollection(handle);
  return { title: collection?.title ?? "Not found" };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const collection = await findCollection(handle);
  if (!collection) notFound();

  const products = await getCollectionProducts(handle);

  return (
    <>
      <Header />
      <main id="page">
        <div className="px-4 pt-24 lg:px-6 lg:pt-32">
          <BackLink className="mb-6" />
          <h1 className="t-display mb-5 text-[clamp(2.5rem,9vw,6rem)]">
            {collection.title}
          </h1>
          <div className="gradient-fill mb-6 h-[5px] w-full" />
          <PerksStrip className="mb-10" />

          {products.length > 0 ? (
            <>
              <SectionHeader
                label={collection.kind === "team" ? "Team" : "Category"}
                aside={`${products.length}`}
              />
              <GridReveal>
                <ProductGrid products={products} />
              </GridReveal>
            </>
          ) : (
            <div className="gradient-ucl flex flex-col gap-5 p-6 text-white lg:p-10">
              <p className="t-display text-[clamp(2rem,6vw,4rem)]">
                First kits land soon.
              </p>
              <p className="t-label max-w-[44ch] opacity-90">
                Tell us the club and your size on WhatsApp and we&rsquo;ll
                hold one for you — full set, printed with any name and number.
              </p>
              <a
                href={whatsappLink(
                  `Hi 93+, I want to reserve a ${collection.title} kit. Club: … Size: …`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="t-label inline-flex h-12 items-center gap-2 self-start bg-white px-5 text-[#101c6b]"
              >
                Reserve on WhatsApp
                <Arrow />
              </a>
            </div>
          )}
        </div>
        <UtilityRow />
        <Footer />
      </main>
    </>
  );
}
