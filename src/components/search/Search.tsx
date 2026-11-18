"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProductPhoto } from "@/components/shop/ProductPhoto";
import { useSite } from "@/components/providers/SiteProvider";
import type { SearchItem } from "@/lib/commerce/types";
import { cn, normalise } from "@/lib/utils";

const SearchContext = createContext<{ open: () => void }>({ open: () => {} });

export const useSearch = () => useContext(SearchContext);

/** The index, fetched once per page load and kept. */
let cached: SearchItem[] | null = null;
let loading: Promise<SearchItem[]> | null = null;

function loadIndex() {
  if (cached) return Promise.resolve(cached);
  loading ??= fetch("/search-index")
    .then((r) => r.json() as Promise<SearchItem[]>)
    .then((items) => (cached = items))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/**
 * For the person who came for one thing. The index is one small JSON file,
 * fetched in the page's idle time right after it loads (and on open, if
 * that comes first), so results update on every keystroke with no round
 * trip and the first result is one Enter away. It used to ride inside every
 * page's HTML, which every visitor paid for whether they searched or not.
 */
export function SearchProvider({
  suggestions,
  children,
}: {
  /** Quick picks shown before anything is typed — teams, leagues, kinds. */
  suggestions: string[];
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[]>(() => cached ?? []);
  const open = useCallback(() => setOpen(true), []);

  // Warm the index once the page is idle; a search that comes first loads it then.
  useEffect(() => {
    let cancelled = false;
    const warm = () => loadIndex().then((i) => !cancelled && setItems(i)).catch(() => {});
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const t = w.requestIdleCallback ? w.requestIdleCallback(warm) : window.setTimeout(warm, 1500);
    return () => {
      cancelled = true;
      if (!w.requestIdleCallback) window.clearTimeout(t);
    };
  }, []);
  useEffect(() => {
    if (isOpen && !cached) loadIndex().then(setItems).catch(() => {});
  }, [isOpen]);

  // "/" or ⌘K opens it on a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (window.location.pathname.startsWith("/admin")) return; // the editor has its own search
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchContext.Provider value={{ open }}>
      {children}
      {isOpen && (
        <SearchPanel
          items={items}
          suggestions={suggestions}
          onClose={() => setOpen(false)}
        />
      )}
    </SearchContext.Provider>
  );
}

export function SearchButton({ className }: { className?: string }) {
  const { open } = useSearch();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search the shop"
      className={cn("link-hover", className)}
    >
      Search
    </button>
  );
}

/** Edit distance with swapped letters counted once, capped: "ronldo" → "ronaldo" is 1. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] | null = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How far a typed word may be from a real one: not at all under 4 letters, 1 up to 7, 2 from 8. */
const slack = (w: string) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

/** 0 = the word is in there, 1 = a typo away, -1 = not this item. */
function matchWord(tokens: string[], w: string) {
  if (tokens.some((t) => t.includes(w))) return 0;
  const max = slack(w);
  if (!max) return -1;
  return tokens.some((t) => distance(w, t, max) <= max) ? 1 : -1;
}

function rank(items: SearchItem[], query: string) {
  const q = normalise(query);
  if (!q) return [];
  const words = q.split(" ");
  return items
    .flatMap((item, i) => {
      const tokens = item.keywords.split(" ");
      let typos = 0;
      for (const w of words) {
        const m = matchWord(tokens, w);
        if (m < 0) return [];
        typos += m;
      }
      const title = normalise(item.title);
      // Exact title matches first; a typo away ranks after every clean hit.
      const score = (title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2) + typos * 3;
      return [{ item, score, i }];
    })
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((r) => r.item);
}

function SearchPanel({
  items,
  suggestions,
  onClose,
}: {
  items: SearchItem[];
  suggestions: string[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { lenis } = useSite();
  const results = useMemo(() => rank(items, query), [items, query]);

  // The page underneath stays put while the panel is open.
  useEffect(() => {
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    input.current?.focus();
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = "";
    };
  }, [lenis]);

  // Picking a result navigates; the panel goes with it.
  const opened = useRef(pathname);
  useEffect(() => {
    if (pathname !== opened.current) onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex flex-col bg-ground"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (results[0]) router.push(`/product/${results[0].handle}`);
        }}
        className="flex items-center gap-3 border-b border-hairline px-4 py-4 lg:px-6 lg:py-6"
      >
        <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5 shrink-0 text-ink-dim">
          <circle cx="8.5" cy="8.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m13.5 13.5 5 5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        {/* 16px or larger, or iOS zooms the page on focus and stays zoomed. */}
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Team, player, league…"
          aria-label="Search"
          className="t-title min-w-0 flex-1 bg-transparent text-2xl outline-none placeholder:text-ink-dim/50 focus-visible:outline-none lg:text-4xl [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={onClose}
          className="t-label min-h-10 shrink-0 border border-ink/35 px-3.5 hover:border-ink"
        >
          Close
        </button>
      </form>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 lg:px-6" data-lenis-prevent>
        {!query.trim() ? (
          <>
            <p className="t-meta mb-3 text-ink-dim">Try</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuery(s);
                    input.current?.focus();
                  }}
                  className="t-label min-h-10 border border-hairline px-3.5 hover:border-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : results.length === 0 ? (
          <p className="t-title text-ink-mid">
            Nothing for &ldquo;{query.trim()}&rdquo; yet. Ask us on WhatsApp —
            we can usually get it.
          </p>
        ) : (
          <>
            <p className="t-meta mb-3 text-ink-dim">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
            <ul className="grid gap-x-6 lg:grid-cols-2">
              {results.map((item) => (
                <li key={item.handle} className="border-b border-hairline">
                  <Link
                    href={`/product/${item.handle}`}
                    onClick={onClose}
                    className="flex items-center gap-4 py-3"
                  >
                    <div className="relative aspect-shirt w-14 shrink-0 overflow-hidden bg-panel">
                      <ProductPhoto image={item.image} sizes="56px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="t-title line-clamp-2">{item.title}</p>
                      <p className="t-meta mt-1 text-ink-dim">{item.category}</p>
                    </div>
                    <p className="t-title shrink-0 tabular-nums text-ink-mid">{item.price}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
