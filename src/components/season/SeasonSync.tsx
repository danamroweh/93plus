"use client";

import { useEffect } from "react";
import type { SeasonId } from "@/lib/seasons";

/**
 * Layouts can't read searchParams, so `?season=european-nights` is applied
 * to <html> from the client. Preview affordance only — the calendar drives
 * the real thing from the server in layout.tsx, so there's no flash unless
 * you're deliberately previewing another season.
 */
export function SeasonSync({ season }: { season: SeasonId }) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.season !== season) root.dataset.season = season;
  }, [season]);

  return null;
}
