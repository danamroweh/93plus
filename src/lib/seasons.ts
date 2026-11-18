/**
 * 93+ · Seasons
 *
 * One switch changes the temperature of the whole site: the gradient, the
 * clock the preloader counts to, the six stills, and one line of copy.
 * Layout, type, logo and the black/white base never move — returning
 * buyers should never have to relearn the shop.
 *
 * Gradients live in globals.css keyed off `data-season` on <html>.
 */

export type SeasonId =
  | "summer-window"
  | "european-nights"
  | "the-run-in"
  | "extra-time"
  | "tournament";

export type Season = {
  id: SeasonId;
  /** Shown in the masthead. Football vernacular, never a competition mark. */
  name: string;
  /** Sits under the permanent line in the meta row. */
  line: string;
  /**
   * The preloader clock, in seconds of match time.
   * League football stops at 90; knockouts run to 120.
   */
  clock: { from: number; to: number; label: string };
  /** Six stills. Atmosphere, not merchandise. */
  stills: string[];
  /** Inclusive start, exclusive end. Ranges may wrap the new year. */
  range?: { from: [month: number, day: number]; to: [month: number, day: number] };
};

const NINETY_THREE = { from: 90 * 60, to: 93 * 60 + 24, label: "93+" };
const ONE_TWENTY = { from: 117 * 60, to: 120 * 60 + 18, label: "120+" };

const stills = (id: string) =>
  Array.from({ length: 6 }, (_, i) => `/stills/${id}-0${i + 1}.jpg`);

export const SEASONS: Record<SeasonId, Season> = {
  "summer-window": {
    id: "summer-window",
    name: "Summer Window",
    line: "New shirts. Old grudges.",
    clock: NINETY_THREE,
    stills: stills("summer-window"),
    range: { from: [6, 15], to: [8, 15] },
  },
  "european-nights": {
    id: "european-nights",
    name: "European Nights",
    line: "Cold nights. Loud rooms.",
    clock: NINETY_THREE,
    stills: stills("european-nights"),
    range: { from: [8, 15], to: [2, 15] },
  },
  "the-run-in": {
    id: "the-run-in",
    name: "The Run-In",
    line: "Nothing is safe.",
    clock: ONE_TWENTY,
    stills: stills("the-run-in"),
    range: { from: [2, 15], to: [5, 15] },
  },
  "extra-time": {
    id: "extra-time",
    name: "Extra Time",
    line: "Nobody sits down.",
    clock: ONE_TWENTY,
    stills: stills("extra-time"),
    range: { from: [5, 15], to: [6, 15] },
  },
  /** Manual only — World Cup, Euros. Never picked by date. */
  tournament: {
    id: "tournament",
    name: "Tournament",
    line: "Everyone is watching.",
    clock: ONE_TWENTY,
    stills: stills("tournament"),
  },
};

export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];

/**
 * Set to a SeasonId to pin the site to one season regardless of date.
 * Leave null to let the calendar decide.
 *
 * Pinned to summer-window so the gradient stays red and orange — the ramp
 * sampled off the product photography. The calendar would otherwise swing
 * the brand colour to blue in September, which is a bigger identity change
 * than a season should make. Set to null to let the dates drive it again;
 * the name, line and clock still rotate either way.
 */
export const SEASON_OVERRIDE: SeasonId | null = "summer-window";

const dayOfYear = (month: number, day: number) => month * 100 + day;

function inRange(date: Date, range: NonNullable<Season["range"]>) {
  const today = dayOfYear(date.getMonth() + 1, date.getDate());
  const from = dayOfYear(...range.from);
  const to = dayOfYear(...range.to);
  // A range that wraps the new year (Aug 15 → Feb 15) is two spans.
  return from <= to ? today >= from && today < to : today >= from || today < to;
}

/** The season for a given date, or the pinned override. */
export function getSeason(date = new Date()): Season {
  if (SEASON_OVERRIDE) return SEASONS[SEASON_OVERRIDE];
  const match = SEASON_IDS.map((id) => SEASONS[id]).find(
    (s) => s.range && inRange(date, s.range),
  );
  return match ?? SEASONS["summer-window"];
}

/** `?season=european-nights` previews any season without shipping a change. */
export function resolveSeason(param?: string | null): Season {
  if (param && param in SEASONS) return SEASONS[param as SeasonId];
  return getSeason();
}

/** 5604 → "93:24" */
export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
