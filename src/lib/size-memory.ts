/**
 * The size someone took last time, kept on their phone. Read after mount
 * only — there's no localStorage on the server, and a private window may
 * refuse it, so every call is guarded.
 */
const KEY = "93plus:size";

export function readSize(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveSize(size: string) {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* private mode — nothing remembered, nothing broken */
  }
}
