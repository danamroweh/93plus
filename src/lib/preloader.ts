/**
 * Shared by the Preloader (client) and the root layout's inline script
 * (server). Lives outside the "use client" module so the server gets the
 * values rather than client references.
 */
export const SEEN_KEY = "93plus:preloaded";
/** The brand moment replays for a visitor once a month, not every visit. */
export const SEEN_FOR_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Where the brand moment plays: the home page and its season previews.
 * Someone opening a shirt link from WhatsApp came for the shirt.
 */
export const HOME_PATH = /^\/(season\/[^/]+\/?)?$/;
