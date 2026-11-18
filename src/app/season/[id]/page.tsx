import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeScreen } from "@/components/home/HomeScreen";
import { SEASONS, SEASON_IDS, type SeasonId } from "@/lib/seasons";

/**
 * Preview the homepage in any season without shipping a change. Not for
 * search engines. Unknown ids 404 below (no `dynamicParams = false`: on
 * Netlify that 404'd the real ones too once a save marked pages stale).
 */
export const revalidate = 900;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return SEASON_IDS.map((id) => ({ id }));
}

export default async function SeasonPreview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(id in SEASONS)) notFound();
  return <HomeScreen season={SEASONS[id as SeasonId]} />;
}
