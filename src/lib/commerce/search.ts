/**
 * 93+ · Search index
 *
 * Built once on the server and handed to the search overlay whole — a few
 * dozen products is a few kilobytes, so every keystroke filters locally with
 * no round trip. That's the "fast" in fast search.
 *
 * Each product answers to more than its title: its club's other names
 * ("barca", "juve"), its league, its kit type and what kind of thing it is.
 */

import { CATEGORIES, TEAM_ALIASES } from "./catalogue";
import type { Product, SearchItem } from "./types";
import { formatPrice, normalise } from "@/lib/utils";

const CATEGORY_TITLES = new Map(CATEGORIES);

/** How the players are typed in Arabic. Keyed by the preset name in the catalogue. */
const PLAYERS_AR: Record<string, string[]> = {
  RONALDO: ["رونالدو", "كريستيانو", "كرستيانو"],
  MESSI: ["ميسي", "ليو"],
  NEYMAR: ["نيمار"],
  MBAPPÉ: ["مبابي"],
  KANE: ["كين"],
  YAMAL: ["يامال", "لامين"],
  KROOS: ["كروس"],
  BECKHAM: ["بيكهام"],
  GERRARD: ["جيرارد"],
  HENRY: ["هنري"],
  KAKA: ["كاكا"],
  SNEIJDER: ["سنايدر"],
  ROBBEN: ["روبن"],
  RAMOS: ["راموس"],
};

/** Kinds of thing, in Arabic. */
const WORDS_AR: Record<string, string[]> = {
  shirt: ["قميص", "طقم", "تيشيرت", "تيشرت", "جيرسي", "فانيلا"],
  Retro: ["ريترو", "قديم", "كلاسيك"],
  Mug: ["كوب", "مج"],
  Pillow: ["مخدة", "وسادة"],
  Keychain: ["ميدالية", "ميدالية مفاتيح"],
  "champions-league": ["دوري الابطال", "ابطال اوروبا", "تشامبيونز"],
};

/**
 * `teams` and `leagues` include the ones added in the shop editor, which
 * answer to their name and league (they have no aliases yet).
 */
export function searchIndex(
  products: Product[],
  teams: Record<string, string>,
  leagues: { title: string; teams: string[] }[],
): SearchItem[] {
  const aliases = TEAM_ALIASES as Record<string, string[]>;
  return products.map((p) => {
    const words = [p.title, p.category, p.set ?? ""];
    for (const handle of p.collections ?? []) {
      if (handle in teams) {
        words.push(teams[handle], ...(aliases[handle] ?? []));
        const league = leagues.find((l) => l.teams.includes(handle));
        if (league) words.push(league.title);
      }
      const category = CATEGORY_TITLES.get(handle);
      if (category) words.push(category);
      if (handle === "champions-league") words.push("ucl", ...WORDS_AR["champions-league"]);
    }
    if (p.customisable) words.push("shirt", "jersey", "kit", "set", ...WORDS_AR.shirt);
    words.push(...(WORDS_AR[p.category] ?? []));
    for (const preset of [p.preset, ...(p.presets ?? [])])
      if (preset) words.push(preset.name, preset.number, ...(PLAYERS_AR[preset.name] ?? []));

    const min = p.priceRange.min;
    const ranged = min.cents !== p.priceRange.max.cents;
    // A 56px thumbnail: the smallest copy, and none of the blur/srcset
    // baggage a full product photo carries.
    const front = p.images[0];
    const image = {
      ...front,
      url: front.srcSet?.split(", ")[0].split(" ")[0] ?? front.url,
      srcSet: undefined,
      blur: undefined,
    };
    return {
      handle: p.handle,
      title: p.title,
      price: `${ranged ? "From " : ""}${formatPrice(min.cents, min.currency)}`,
      category: p.category,
      image,
      keywords: normalise(words.join(" ")),
    };
  });
}
