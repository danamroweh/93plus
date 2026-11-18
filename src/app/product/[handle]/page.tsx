import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductView } from "@/components/shop/ProductView";
import { CompleteTheKit } from "@/components/shop/CompleteTheKit";
import { getProduct, getProducts } from "@/lib/commerce";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return { title: "Not found" };
  return {
    title: product.title,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [product, all] = await Promise.all([getProduct(handle), getProducts()]);
  if (!product) notFound();

  return (
    <>
      <Header />
      {/* Room for the phone's sticky add bar over the footer. */}
      <main id="page" className="pb-16 lg:pb-0">
        <ProductView product={product} />
        <CompleteTheKit products={all} currentHandle={product.handle} />
        <Footer />
      </main>
    </>
  );
}
