import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionHeader } from "@/components/shop/Section";
import { BackLink } from "@/components/ui/Buttons";
import { INFO_PAGES, getInfoPage } from "@/lib/info";

export const dynamicParams = false;

export function generateStaticParams() {
  return INFO_PAGES.map((p) => ({ page: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return { title: getInfoPage(page)?.title ?? "Not found" };
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: slug } = await params;
  const page = getInfoPage(slug);
  if (!page) notFound();

  return (
    <>
      <Header />
      <main id="page">
        <div className="px-4 pt-24 lg:px-6 lg:pt-32">
          <BackLink className="mb-6" />
          <h1 className="t-display mb-5 text-[clamp(2.5rem,9vw,6rem)]">
            {page.title}
          </h1>
          <div className="gradient-fill mb-6 h-[5px] w-full" />
          <p className="t-label mb-16 max-w-xl">{page.lede}</p>

          <div className="flex max-w-3xl flex-col gap-14">
            {page.blocks.map((block, i) =>
              block.kind === "text" ? (
                <section key={i}>
                  {block.heading && <SectionHeader label={block.heading} />}
                  <p className="max-w-xl leading-relaxed">{block.body}</p>
                </section>
              ) : (
                <section key={i}>
                  {block.heading && <SectionHeader label={block.heading} />}
                  <table className="w-full border-collapse tabular-nums">
                    <thead>
                      <tr>
                        {block.head.map((h) => (
                          <th
                            key={h}
                            className="t-meta border-b border-hairline py-3 pr-4 text-left font-normal text-ink-dim"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, j) => (
                            <td key={j} className="border-b border-hairline py-3 pr-4">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {block.note && (
                    <p className="t-meta mt-3 text-ink-dim">{block.note}</p>
                  )}
                </section>
              ),
            )}
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}
