import { HomeScreen } from "@/components/home/HomeScreen";
import { getSeason } from "@/lib/seasons";

/**
 * Built once and served as a file, so a drop hits the CDN and not the
 * server. Best sellers come from the order sheet, so the page is rebuilt in
 * the background at most every fifteen minutes. Season previews live at
 * /season/<id>; a `?season=` here would have made every visit a render.
 */
export const revalidate = 900;

export default function Home() {
  return <HomeScreen season={getSeason()} />;
}
