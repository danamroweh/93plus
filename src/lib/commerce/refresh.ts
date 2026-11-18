import { revalidatePath } from "next/cache";

/**
 * After the catalogue changes — an edit in the shop editor, or an order
 * taking the last shirt of a size — every built page is marked stale. Each
 * rebuilds on its next visit, so nothing is regenerated that nobody opens.
 */
export function refreshShop() {
  revalidatePath("/", "layout");
  revalidatePath("/search-index");
}
