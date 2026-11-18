/**
 * 93+ · Launch catalogue
 *
 * The single source of truth for what the shop sells until Shopify takes
 * over. Two consumers:
 *   - the mock adapter, which builds Products from it for the demo
 *   - `scripts/shopify-csv.mts`, which turns it into Shopify's product
 *     import CSV, so the store starts with exactly this list
 *
 * Self-contained on purpose (no imports) so Node can run the export
 * script straight off this file.
 *
 * Collections are tags: every handle in a product's `collections` becomes
 * a Shopify tag, and each Shopify collection is a smart collection with
 * the rule "tag is equal to <handle>". Same membership on both sides.
 */

export type Kit = "Home" | "Away" | "Third" | "Retro" | "Long sleeve" | "Tracksuit";
export type Item = "Keychain" | "Pillow" | "Mug";

export type ShirtEntry = {
  kind: "shirt";
  handle: string;
  title: string;
  /** Team collection handle — a key of TEAMS. */
  team: keyof typeof TEAMS;
  kit: Kit;
  description: string;
  /** Pre-fills the name + number fields — "Ronaldo 7" on the retros. */
  preset?: { name: string; number: string };
  /**
   * A choice of pre-printed players on one shirt — the PSG retro comes as
   * Messi, Neymar, Mbappé or Ramos. The first is the default.
   */
  presets?: { name: string; number: string }[];
  /**
   * Name + number placement measured off this shirt's back photo (tops in %
   * of height, sizes and centre in cqw). Without it the preview uses the
   * stand-in artwork's placement.
   */
  print?: {
    nameTop: number;
    nameSize: number;
    numberTop: number;
    numberSize: number;
    centre?: number;
    lightInk?: string;
    blend?: string;
  };
  soldOutSizes?: string[];
  soldOut?: boolean;
  /** Overrides PRICES.fan / PRICES.player, in cents. */
  fan?: number;
  player?: number;
  /** Champions League edition — listed in the UCL section as well as its team. */
  ucl?: boolean;
};

export type PrintableEntry = {
  kind: "printable";
  handle: string;
  title: string;
  item: Item;
  team?: keyof typeof TEAMS;
  description: string;
  /** Overrides PRICES[item], in cents. */
  cents?: number;
};

export type CatalogueEntry = ShirtEntry | PrintableEntry;

/** Launch prices, in cents. Provisional — Hadi will revise. */
export const PRICES = {
  fan: 2500,
  player: 3700,
  printing: 1000,
  /** Retros are one price, printing included (Dana, Oct 18 2026). */
  retro: 4000,
  /** Long sleeve and tracksuit prices still to come from Dana — placeholders. */
  longSleeve: 3000,
  tracksuit: 4500,
  Keychain: 500,
  Mug: 700,
  Pillow: 1500,
} as const;

export const SIZES = ["S", "M", "L", "XL", "XXL"];
export const VERSIONS = ["Fan", "Player"];
export const CUSTOM = ["Blank", "Name + Number"];

/**
 * Team collections, in rail order — the clubs people ask for most first,
 * then the national teams. Handle → the name fans actually use. Clubs,
 * never cities: Milan is two teams, and nobody searches for "Merseyside".
 */
export const TEAMS = {
  "real-madrid": "Real Madrid",
  barcelona: "Barcelona",
  "man-united": "Man United",
  liverpool: "Liverpool",
  "man-city": "Man City",
  chelsea: "Chelsea",
  arsenal: "Arsenal",
  psg: "PSG",
  "bayern-munich": "Bayern Munich",
  juventus: "Juventus",
  "ac-milan": "AC Milan",
  inter: "Inter",
  "al-nassr": "Al Nassr",
  "inter-miami": "Inter Miami",
  sporting: "Sporting CP",
  argentina: "Argentina",
  brazil: "Brazil",
  portugal: "Portugal",
  france: "France",
  spain: "Spain",
  england: "England",
  germany: "Germany",
} as const;

export type TeamHandle = keyof typeof TEAMS;

/** Countries, not clubs — they get their own rail and their own page. */
export const NATIONAL_TEAMS: TeamHandle[] = [
  "argentina",
  "brazil",
  "portugal",
  "france",
  "spain",
  "england",
  "germany",
];

/** Other names people type into search for each club. */
export const TEAM_ALIASES: Record<TeamHandle, string[]> = {
  "real-madrid": ["real", "madrid", "rmcf", "los blancos", "ريال مدريد", "ريال", "الريال", "مدريد"],
  barcelona: ["barca", "barça", "fcb", "blaugrana", "برشلونة", "برشا", "البارسا", "بارسا"],
  "man-united": ["manchester united", "man utd", "united", "mufc", "red devils", "مانشستر يونايتد", "مان يونايتد", "يونايتد"],
  liverpool: ["lfc", "reds", "ليفربول"],
  "man-city": ["manchester city", "city", "mcfc", "citizens", "مانشستر سيتي", "مان سيتي", "سيتي"],
  chelsea: ["cfc", "blues", "تشيلسي", "تشلسي"],
  arsenal: ["gunners", "ارسنال", "آرسنال"],
  psg: ["paris", "paris saint-germain", "paris saint germain", "باريس", "باريس سان جيرمان", "بي اس جي"],
  "bayern-munich": ["bayern", "munich", "fc bayern", "بايرن", "بايرن ميونخ", "بايرن ميونيخ"],
  juventus: ["juve", "يوفنتوس", "يوفي", "اليوفي"],
  "ac-milan": ["milan", "rossoneri", "ميلان", "اي سي ميلان"],
  inter: ["inter milan", "internazionale", "nerazzurri", "انتر", "انتر ميلان", "الانتر"],
  "al-nassr": ["nassr", "al nasr", "alnassr", "النصر", "نصر"],
  "inter-miami": ["miami", "انتر ميامي", "ميامي"],
  sporting: ["sporting lisbon", "scp", "سبورتينغ", "سبورتنغ لشبونة"],
  argentina: ["albiceleste", "afa", "الارجنتين", "ارجنتين"],
  brazil: ["brasil", "selecao", "seleção", "البرازيل", "برازيل"],
  portugal: ["selecao das quinas", "البرتغال", "برتغال"],
  france: ["les bleus", "fff", "فرنسا"],
  spain: ["espana", "españa", "la roja", "اسبانيا", "إسبانيا"],
  england: ["three lions", "انجلترا", "انكلترا", "إنجلترا"],
  germany: ["deutschland", "die mannschaft", "dfb", "المانيا", "ألمانيا"],
};

/**
 * Leagues sit above teams: pick the league, then the club. Leagues in rail
 * order, and each league's teams from most to least famous — that's the
 * order its page lists them in. National teams are grouped the same way
 * but get their own rail on the homepage (`nations`).
 */
export const LEAGUES: {
  handle: string;
  title: string;
  teams: TeamHandle[];
  nations?: boolean;
}[] = [
  { handle: "la-liga", title: "La Liga", teams: ["real-madrid", "barcelona"] },
  {
    handle: "premier-league",
    title: "Premier League",
    teams: ["man-united", "liverpool", "man-city", "chelsea", "arsenal"],
  },
  { handle: "serie-a", title: "Serie A", teams: ["juventus", "ac-milan", "inter"] },
  { handle: "bundesliga", title: "Bundesliga", teams: ["bayern-munich"] },
  { handle: "ligue-1", title: "Ligue 1", teams: ["psg"] },
  { handle: "saudi-pro-league", title: "Saudi Pro League", teams: ["al-nassr"] },
  { handle: "mls", title: "MLS", teams: ["inter-miami"] },
  { handle: "liga-portugal", title: "Liga Portugal", teams: ["sporting"] },
  {
    handle: "national-teams",
    title: "National teams",
    teams: NATIONAL_TEAMS,
    nations: true,
  },
];

/**
 * Champions League kits. A collection like any other (tag `champions-league`),
 * but it has its own section on the homepage and its page stays open while
 * it's still empty, so people can ask for one before the first drop lands.
 */
export const UCL = { handle: "champions-league", title: "Champions League" } as const;

/**
 * Clubs whose whole shirt range sits in the Champions League section (Dana,
 * Oct 18 2026), on top of the single `ucl: true` retros. Tracksuits stay out.
 */
const UCL_TEAMS: readonly string[] = ["real-madrid", "psg", "arsenal", "bayern-munich", "inter"];

/**
 * What a shirt order actually is. Every kit ships as a full set — people kept
 * asking — so this sits on the card, the product page and the Shopify copy.
 * Change it here if socks join the set.
 */
export const SET_CONTENTS = "Shirt + shorts";
export const TRACKSUIT_CONTENTS = "Jacket + pants";

/**
 * Category collections, in rail order. Empty ones hide themselves.
 * Keychains, mugs and pillows all live under Accessories.
 */
export const CATEGORIES: [handle: string, title: string][] = [
  [UCL.handle, UCL.title],
  ["home-kits", "Home Kits"],
  ["away-kits", "Away Kits"],
  ["third-kits", "Third Kits"],
  ["retro", "Retro"],
  ["long-sleeves", "Long Sleeves"],
  ["tracksuits", "Tracksuits"],
  ["accessories", "Accessories"],
  ["kids", "Kids"],
];

/**
 * A hand-picked "best-sellers" collection from before the row was ranked by
 * orders. Still hidden from the rails if a store has one.
 */
export const BEST_SELLERS = "best-sellers";

const RONALDO = { name: "RONALDO", number: "7" };

export const CATALOGUE: CatalogueEntry[] = [
  // ── shirts ──────────────────────────────────────────────────────────
  {
    kind: "shirt",
    handle: "real-madrid-home-26-27",
    title: "Real Madrid Home 26/27",
    team: "real-madrid",
    kit: "Home",
    description:
      "All white, no excuses. The shirt that decided more late minutes than any other.",
    print: { nameTop: 29.5, nameSize: 6, numberTop: 36.5, numberSize: 30, centre: 51.6 },
  },
  {
    kind: "shirt",
    handle: "real-madrid-third-26-27",
    title: "Real Madrid Third 26/27",
    team: "real-madrid",
    kit: "Third",
    description: "For the nights the script's already written.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(250, 240, 214, 0.92)",
    },
  },
  {
    kind: "shirt",
    handle: "real-madrid-2011-12-home",
    title: "Real Madrid 2011/12 Home",
    team: "real-madrid",
    kit: "Retro",
    description: "The hundred-point season. Comes ready as Ronaldo 7.",
    preset: RONALDO,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.3 },
  },
  {
    kind: "shirt",
    handle: "real-madrid-2017-18-home",
    title: "Real Madrid 2017/18 Home",
    team: "real-madrid",
    kit: "Retro",
    description: "The third final in a row. Ronaldo 7, already on the back.",
    preset: RONALDO,
    print: {
      nameTop: 29,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 50.2,
    },
  },
  {
    kind: "shirt",
    handle: "barcelona-home-26-27",
    title: "Barcelona Home 26/27",
    team: "barcelona",
    kit: "Home",
    description: "The stripes everyone recognises from the back row.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(236, 192, 84, 0.92)",
    },
  },
  {
    kind: "shirt",
    handle: "barcelona-away-26-27",
    title: "Barcelona Away 26/27",
    team: "barcelona",
    kit: "Away",
    description: "Purple, for the away end. Loud on purpose.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 52.7,
      lightInk: "rgba(236, 192, 84, 0.92)",
    },
  },
  {
    kind: "shirt",
    handle: "barcelona-third-26-27",
    title: "Barcelona Third 26/27",
    team: "barcelona",
    kit: "Third",
    description: "Teal. The shirt for the nights nobody predicted.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(24, 34, 120, 0.88)",
    },
  },
  {
    kind: "shirt",
    handle: "liverpool-home-26-27",
    title: "Liverpool Home 26/27",
    team: "liverpool",
    kit: "Home",
    description: "Red, loud, and never quiet before the ninetieth.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(255, 255, 255, 0.9)",
    },
  },
  {
    kind: "shirt",
    handle: "liverpool-away-26-27",
    title: "Liverpool Away 26/27",
    team: "liverpool",
    kit: "Away",
    description: "Away days, cold kickoffs, and a shirt built for both.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(122, 24, 44, 0.88)",
    },
  },
  {
    kind: "shirt",
    handle: "juventus-home-26-27",
    title: "Juventus Home 26/27",
    team: "juventus",
    kit: "Home",
    description: "The most decided-looking shirt in football.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
    },
  },
  {
    kind: "shirt",
    handle: "juventus-2019-20-home",
    title: "Juventus 2019/20 Home",
    team: "juventus",
    kit: "Retro",
    description: "Black, white, and Ronaldo 7 across the shoulders.",
    preset: RONALDO,
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "#ffffff",
      blend: "difference",
    },
  },
  {
    kind: "shirt",
    handle: "ac-milan-home-26-27",
    title: "AC Milan Home 26/27",
    team: "ac-milan",
    kit: "Home",
    description: "Stripes that have been arguing with each other since 1899.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.8,
      lightInk: "rgba(255, 255, 255, 0.9)",
    },
  },
  {
    kind: "shirt",
    handle: "inter-home-26-27",
    title: "Inter Home 26/27",
    team: "inter",
    kit: "Home",
    description: "Black and blue — the other half of the city's argument.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 50.9,
      lightInk: "rgba(236, 192, 84, 0.92)",
    },
  },
  {
    kind: "shirt",
    handle: "arsenal-home-26-27",
    title: "Arsenal Home 26/27",
    team: "arsenal",
    kit: "Home",
    description: "Red body, white sleeves, unchanged since anyone remembers.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.6,
      lightInk: "rgba(255, 255, 255, 0.9)",
    },
  },
  {
    kind: "shirt",
    handle: "arsenal-away-26-27",
    title: "Arsenal Away 26/27",
    team: "arsenal",
    kit: "Away",
    description: "Navy, for the long trips north.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(246, 200, 60, 0.92)",
    },
  },
  {
    kind: "shirt",
    handle: "bayern-home-26-27",
    title: "Bayern Home 26/27",
    team: "bayern-munich",
    kit: "Home",
    description: "Efficient in every minute, including the ones after ninety.",
    print: {
      nameTop: 30,
      nameSize: 6,
      numberTop: 37,
      numberSize: 30,
      centre: 51.7,
      lightInk: "rgba(255, 255, 255, 0.9)",
    },
  },

  // New for Dana's expansion (Oct 2026) — home kits, player pre-printed
  // where her list names one.
  {
    kind: "shirt",
    handle: "al-nassr-home-26-27",
    title: "Al Nassr Home 26/27",
    team: "al-nassr",
    kit: "Home",
    description: "Riyadh yellow, and the seven on the back still runs the show.",
    preset: { name: "RONALDO", number: "7" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "inter-miami-home-2026",
    title: "Inter Miami Home 2026",
    team: "inter-miami",
    kit: "Home",
    description: "Pink, loud, and still Messi's ten.",
    preset: { name: "MESSI", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "man-united-home-26-27",
    title: "Man United Home 26/27",
    team: "man-united",
    kit: "Home",
    description: "Red, the way Old Trafford likes it.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "man-city-home-26-27",
    title: "Man City Home 26/27",
    team: "man-city",
    kit: "Home",
    description: "Sky blue, and the habit of winning.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "chelsea-home-26-27",
    title: "Chelsea Home 26/27",
    team: "chelsea",
    kit: "Home",
    description: "Royal blue for the Bridge and the long cup runs.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "psg-home-26-27",
    title: "PSG Home 26/27",
    team: "psg",
    kit: "Home",
    description: "The red-and-white stripe down the middle — Paris on your chest.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "argentina-home-2026",
    title: "Argentina Home 2026",
    team: "argentina",
    kit: "Home",
    description: "The stripes everyone grew up drawing.",
    preset: { name: "MESSI", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "argentina-messi-farewell-2026",
    title: "Argentina Goodbye Messi Edition",
    team: "argentina",
    kit: "Home",
    description: "The special edition for Messi's last match in sky blue and white. Gold 10 on the back.",
    preset: { name: "MESSI", number: "10" },
    // A 2026 kit, not a retro (Dana, Oct 20): sold as Fan / Player like the
    // other new shirts. Deeper gold than Barça's so it holds on the white centre band.
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(190, 146, 58, 0.96)" },
  },
  {
    kind: "shirt",
    handle: "portugal-home-2026",
    title: "Portugal Home 2026",
    team: "portugal",
    kit: "Home",
    description: "Red and green, and seven on the back.",
    preset: { name: "RONALDO", number: "7" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "brazil-home-2026",
    title: "Brazil Home 2026",
    team: "brazil",
    kit: "Home",
    description: "The yellow that made the game look easy.",
    preset: { name: "NEYMAR", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(20, 60, 140, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "france-home-2026",
    title: "France Home 2026",
    team: "france",
    kit: "Home",
    description: "Navy for the nights France makes it look routine.",
    preset: { name: "MBAPPÉ", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "spain-home-2026",
    title: "Spain Home 2026",
    team: "spain",
    kit: "Home",
    description: "Red and gold, built for the next tournament run.",
    preset: { name: "YAMAL", number: "19" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(246, 200, 60, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "england-home-2026",
    title: "England Home 2026",
    team: "england",
    kit: "Home",
    description: "White, three lions, another summer of believing.",
    preset: { name: "KANE", number: "9" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "germany-home-2026",
    title: "Germany Home 2026",
    team: "germany",
    kit: "Home",
    description: "The 1990 chevrons, back where they belong.",
    preset: { name: "KROOS", number: "8" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },

  // ── away kits (Oct 18 2026) — every team that didn't have one ────────
  {
    kind: "shirt",
    handle: "real-madrid-away-26-27",
    title: "Real Madrid Away 26/27",
    team: "real-madrid",
    kit: "Away",
    description: "Deep green with the trefoil back on the chest.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(240, 236, 224, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "man-united-away-26-27",
    title: "Man United Away 26/27",
    team: "man-united",
    kit: "Away",
    description: "Royal blue, red and white trim. Made for the away end.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "man-city-away-26-27",
    title: "Man City Away 26/27",
    team: "man-city",
    kit: "Away",
    description: "Black and pale gold, quietly expensive.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(236, 210, 150, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "chelsea-away-26-27",
    title: "Chelsea Away 26/27",
    team: "chelsea",
    kit: "Away",
    description: "Black with gold trim and a gold lion.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(236, 196, 80, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "psg-away-26-27",
    title: "PSG Away 26/27",
    team: "psg",
    kit: "Away",
    description: "White, with the red and blue band down the middle.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(20, 30, 70, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "bayern-away-26-27",
    title: "Bayern Munich Away 26/27",
    team: "bayern-munich",
    kit: "Away",
    description: "Clean white with navy and red trim.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(20, 30, 70, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "juventus-away-26-27",
    title: "Juventus Away 26/27",
    team: "juventus",
    kit: "Away",
    description: "Pink and black, the colours Juve started in.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "ac-milan-away-26-27",
    title: "AC Milan Away 26/27",
    team: "ac-milan",
    kit: "Away",
    description: "White with red and black at the collar.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "inter-away-26-27",
    title: "Inter Away 26/27",
    team: "inter",
    kit: "Away",
    description: "White with navy pinstripes, sharp as a suit.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(20, 30, 70, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "inter-miami-away-2026",
    title: "Inter Miami Away 2026",
    team: "inter-miami",
    kit: "Away",
    description: "Black with pink, the Miami night version.",
    preset: { name: "MESSI", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(245, 175, 200, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "al-nassr-away-26-27",
    title: "Al Nassr Away 26/27",
    team: "al-nassr",
    kit: "Away",
    description: "Deep navy and pale yellow, for the Riyadh night.",
    preset: { name: "RONALDO", number: "7" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(240, 222, 150, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "argentina-away-2026",
    title: "Argentina Away 2026",
    team: "argentina",
    kit: "Away",
    description: "Midnight with blue swirls. The champions' second shirt.",
    preset: { name: "MESSI", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "brazil-away-2026",
    title: "Brazil Away 2026",
    team: "brazil",
    kit: "Away",
    description: "The blue Brazil, with yellow where it counts.",
    preset: { name: "NEYMAR", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(250, 214, 60, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "portugal-away-2026",
    title: "Portugal Away 2026",
    team: "portugal",
    kit: "Away",
    description: "Pale mint and Atlantic waves.",
    preset: { name: "RONALDO", number: "7" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(16, 70, 60, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "spain-away-2026",
    title: "Spain Away 2026",
    team: "spain",
    kit: "Away",
    description: "Cream with burgundy and gold trim.",
    preset: { name: "YAMAL", number: "19" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(120, 22, 40, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "germany-away-2026",
    title: "Germany Away 2026",
    team: "germany",
    kit: "Away",
    description: "Navy with an aqua collar.",
    preset: { name: "KROOS", number: "8" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "france-away-2026",
    title: "France Away 2026",
    team: "france",
    kit: "Away",
    description: "Pale mint with fine gold lines.",
    preset: { name: "MBAPPÉ", number: "10" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(20, 30, 70, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "england-away-2026",
    title: "England Away 2026",
    team: "england",
    kit: "Away",
    description: "Red, the colour of '66.",
    preset: { name: "KANE", number: "9" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },

  // ── retros (Dana, Oct 18 2026) — $40, printing included ────────────
  {
    kind: "shirt",
    handle: "man-united-2007-08-home",
    title: "Man United 2007/08 Home",
    team: "man-united",
    kit: "Retro",
    description: "Moscow, 2008: rain, penalties, and the European Cup back in Manchester. Ronaldo 7 on the back.",
    preset: RONALDO,
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "man-united-1998-99-home",
    title: "Man United 1998/99 Home",
    team: "man-united",
    kit: "Retro",
    description: "The Treble season. Beckham 7, and the two corners that turned the Camp Nou final.",
    preset: { name: "BECKHAM", number: "7" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "man-city-2022-23-home",
    title: "Man City 2022/23 Home",
    team: "man-city",
    kit: "Retro",
    description: "Istanbul, 2023. The treble, and the big one finally in sky blue.",
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "chelsea-2011-12-home",
    title: "Chelsea 2011/12 Home",
    team: "chelsea",
    kit: "Retro",
    description: "Munich, 2012. Against the odds, in their own stadium.",
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "liverpool-2004-05-home",
    title: "Liverpool 2004/05 Home",
    team: "liverpool",
    kit: "Retro",
    description: "Istanbul, 2005. Three down at half-time. Gerrard 8, already on the back.",
    preset: { name: "GERRARD", number: "8" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "psg-2022-23-home",
    title: "PSG 2022/23 Home",
    team: "psg",
    kit: "Retro",
    description: "Messi, Neymar, Mbappé and Ramos in one dressing room. One shirt — pick your name.",
    presets: [
      { name: "MESSI", number: "30" },
      { name: "NEYMAR", number: "10" },
      { name: "MBAPPÉ", number: "7" },
      { name: "RAMOS", number: "4" },
    ],
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "barcelona-2014-15-home",
    title: "Barcelona 2014/15 Home",
    team: "barcelona",
    kit: "Retro",
    description: "Messi, Suárez, Neymar, and the treble in Berlin. Messi 10.",
    preset: { name: "MESSI", number: "10" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(236, 192, 84, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "sporting-2002-03-home",
    title: "Sporting CP 2002/03 Home",
    team: "sporting",
    kit: "Retro",
    description: "Where it started: a teenager in Lisbon wearing 28.",
    preset: { name: "RONALDO", number: "28" },
    // Sits under the Banco Espírito Santo back sponsor, solid black so the
    // number survives the hoops.
    print: { nameTop: 35, nameSize: 6, numberTop: 42, numberSize: 28, centre: 51.7, lightInk: "rgba(14, 18, 16, 0.94)" },
  },

  // ── more retros (Dana's list, Oct 18 2026) — the ones the first round left out
  {
    kind: "shirt",
    handle: "man-united-1968-european-cup",
    title: "Man United 1968 European Cup Final",
    team: "man-united",
    kit: "Retro",
    description: "Wembley, 1968. Royal blue, long sleeves, Best and Charlton. United's first European Cup.",
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "man-united-2007-08-away",
    title: "Man United 2007/08 Away",
    team: "man-united",
    kit: "Retro",
    description: "All black, 42 goals. Ronaldo 7 on the back.",
    preset: RONALDO,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "chelsea-2020-21-home",
    title: "Chelsea 2020/21 Home",
    team: "chelsea",
    kit: "Retro",
    description: "Porto, 2021. Kanté everywhere, and the second one for Chelsea.",
    preset: { name: "KANTÉ", number: "7" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "arsenal-2003-04-home",
    title: "Arsenal 2003/04 Home",
    team: "arsenal",
    kit: "Retro",
    description: "The Invincibles. Thirty-eight games, no defeats. Henry 14.",
    preset: { name: "HENRY", number: "14" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "bayern-munich-2012-13-home",
    title: "Bayern Munich 2012/13 Home",
    team: "bayern-munich",
    kit: "Retro",
    description: "Wembley, 2013. The treble, settled by Robben in the 89th minute.",
    preset: { name: "ROBBEN", number: "10" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "ac-milan-2006-07-home",
    title: "AC Milan 2006/07 Home",
    team: "ac-milan",
    kit: "Retro",
    description: "Athens, 2007. Kaká's season, gold 22 on the back.",
    preset: { name: "KAKA", number: "22" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(236, 192, 84, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "inter-2009-10-home",
    title: "Inter 2009/10 Home",
    team: "inter",
    kit: "Retro",
    description: "Madrid, 2010. Mourinho's treble. Sneijder 10.",
    preset: { name: "SNEIJDER", number: "10" },
    ucl: true,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "juventus-2018-19-away",
    title: "Juventus 2018/19 Away",
    team: "juventus",
    kit: "Retro",
    description: "Ronaldo's first season in Turin, in stone and black. Ronaldo 7.",
    preset: RONALDO,
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "sporting-2002-03-away",
    title: "Sporting CP 2002/03 Away",
    team: "sporting",
    kit: "Retro",
    description: "Green and saffron, the away shirt from Ronaldo's first season. Ronaldo 28.",
    preset: { name: "RONALDO", number: "28" },
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },

  // ── long sleeves + tracksuits (Dana, Oct 18 2026) — prices are placeholders
  {
    kind: "shirt",
    handle: "real-madrid-long-sleeve-26-27",
    title: "Real Madrid Home Long Sleeve 26/27",
    team: "real-madrid",
    kit: "Long sleeve",
    description: "The home shirt, sleeves to the wrist. For winter nights at the Bernabéu.",
    print: { nameTop: 29.5, nameSize: 6, numberTop: 36.5, numberSize: 30, centre: 51.6 },
  },
  {
    kind: "shirt",
    handle: "barcelona-long-sleeve-26-27",
    title: "Barcelona Home Long Sleeve 26/27",
    team: "barcelona",
    kit: "Long sleeve",
    description: "Blaugrana all the way down to the cuffs.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(236, 192, 84, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "man-united-long-sleeve-26-27",
    title: "Man United Home Long Sleeve 26/27",
    team: "man-united",
    kit: "Long sleeve",
    description: "The home red with full sleeves, built for Manchester in January.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "liverpool-long-sleeve-26-27",
    title: "Liverpool Home Long Sleeve 26/27",
    team: "liverpool",
    kit: "Long sleeve",
    description: "The home shirt with long sleeves, for cold nights at Anfield.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "juventus-long-sleeve-26-27",
    title: "Juventus Home Long Sleeve 26/27",
    team: "juventus",
    kit: "Long sleeve",
    description: "Black and white stripes, wrist to wrist.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7 },
  },
  {
    kind: "shirt",
    handle: "real-madrid-tracksuit-26-27",
    title: "Real Madrid Tracksuit 26/27",
    team: "real-madrid",
    kit: "Tracksuit",
    description: "Navy and gold, jacket and pants. Your name across the back if you want it.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(236, 192, 84, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "barcelona-tracksuit-26-27",
    title: "Barcelona Tracksuit 26/27",
    team: "barcelona",
    kit: "Tracksuit",
    description: "Teal jacket, navy pants: this season's training colours.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(20, 30, 70, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "man-united-tracksuit-26-27",
    title: "Man United Tracksuit 26/27",
    team: "man-united",
    kit: "Tracksuit",
    description: "Black with the red stripes, jacket and pants.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(255, 255, 255, 0.9)" },
  },
  {
    kind: "shirt",
    handle: "liverpool-tracksuit-26-27",
    title: "Liverpool Tracksuit 26/27",
    team: "liverpool",
    kit: "Tracksuit",
    description: "Off-white with the red band, a terrace classic.",
    print: { nameTop: 30, nameSize: 6, numberTop: 37, numberSize: 30, centre: 51.7, lightInk: "rgba(190, 20, 40, 0.92)" },
  },
  {
    kind: "shirt",
    handle: "juventus-tracksuit-26-27",
    title: "Juventus Tracksuit 26/27",
    team: "juventus",
    kit: "Tracksuit",
    description: "White jacket, black pants, gold details.",
    // Dropped below the shoulder graphic.
    print: { nameTop: 32.5, nameSize: 6, numberTop: 39.5, numberSize: 28, centre: 51.7 },
  },

  // ── printables ──────────────────────────────────────────────────────
  ...printables("ronaldo", "Ronaldo"),
  ...printables("messi", "Messi"),
  ...printables("real-madrid", "Real Madrid", "real-madrid"),
  ...printables("barcelona", "Barcelona", "barcelona"),
  // Dana's "maybe" (Oct 18 2026): the liver bird, not the full crest.
  ...printables("liverpool", "Liverpool", "liverpool"),
];

/** Keychain, pillow and mug for one subject — the sheet sells them as a set. */
function printables(
  slug: string,
  subject: string,
  team?: keyof typeof TEAMS,
): PrintableEntry[] {
  const lines: Record<Item, string> = {
    Keychain: `${subject} on your keys. Small, heavy, unreasonably satisfying.`,
    Pillow: `${subject}, for the naps between kickoffs.`,
    Mug: `${subject}, before the first coffee's finished.`,
  };
  return (["Keychain", "Pillow", "Mug"] as const).map((item) => ({
    kind: "printable",
    handle: `${slug}-${item.toLowerCase()}`,
    title: `${subject} ${item}`,
    item,
    team,
    description: lines[item],
  }));
}

const KIT_COLLECTION: Record<Kit, string> = {
  Home: "home-kits",
  Away: "away-kits",
  Third: "third-kits",
  Retro: "retro",
  "Long sleeve": "long-sleeves",
  Tracksuit: "tracksuits",
};

/**
 * How a shirt is sold. New-season kits come in Fan or Player with printing
 * on top; retros are one price with printing included; long sleeves and
 * tracksuits are one version, printing on top.
 */
export function shirtPricing(
  entry: { kit: Kit; fan?: number; player?: number },
  /** Name + number printing, in cents. The shop editor can change it. */
  printing: number = PRICES.printing,
): {
  versions: string[];
  base: (version?: string) => number;
  printing: number;
} {
  switch (entry.kit) {
    case "Retro":
      return { versions: [], base: () => entry.fan ?? PRICES.retro, printing: 0 };
    case "Long sleeve":
      return { versions: [], base: () => entry.fan ?? PRICES.longSleeve, printing };
    case "Tracksuit":
      return { versions: [], base: () => entry.fan ?? PRICES.tracksuit, printing };
    default:
      return {
        versions: VERSIONS,
        base: (v) => (v === "Player" ? (entry.player ?? PRICES.player) : (entry.fan ?? PRICES.fan)),
        printing,
      };
  }
}

/** Every collection handle an entry belongs to — becomes its Shopify tags. */
export function collectionsOf(entry: {
  kind: CatalogueEntry["kind"];
  team?: string;
  kit?: Kit;
  ucl?: boolean;
}): string[] {
  const tags: string[] = [];
  if (entry.team) tags.push(entry.team);
  if (entry.kind === "shirt" && entry.kit) {
    tags.push(KIT_COLLECTION[entry.kit]);
    if (entry.ucl || (entry.team && UCL_TEAMS.includes(entry.team) && entry.kit !== "Tracksuit"))
      tags.push(UCL.handle);
  } else {
    tags.push("accessories");
  }
  return tags;
}
