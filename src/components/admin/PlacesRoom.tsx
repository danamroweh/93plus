"use client";

import { useState } from "react";
import {
  addCategoryAction,
  addLeagueAction,
  addTeamAction,
  moveTeamAction,
  removeCategoryAction,
} from "@/app/admin/actions";
import { autoCategories, type AdminSnapshot } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Button, Dialog, IconButton, IconClose, IconPlus, IconTrash, Label, Sheet, Spinner, inputClass, type ToastState } from "./parts";

/**
 * Where things live in the shop: the categories (each one a page and a tile
 * in the Categories row) and the leagues with their teams. Products are put
 * into categories from their own sheet; this room makes and arranges the
 * places themselves.
 */
export function PlacesRoom({
  data,
  onData,
  onClose,
  onToast,
}: {
  data: AdminSnapshot;
  onData: (change: (d: AdminSnapshot) => AdminSnapshot) => void;
  onClose: () => void;
  onToast: (t: ToastState) => void;
}) {
  const [newCategory, setNewCategory] = useState("");
  const [newLeague, setNewLeague] = useState("");
  const [team, setTeam] = useState({ title: "", league: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const live = data.products.filter((p) => !p.deleted);
  const inCategory = (h: string) =>
    live.filter((p) => (p.categories ?? autoCategories(p, data.rules)).includes(h)).length;
  const inTeam = (h: string) => live.filter((p) => p.team === h).length;

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch {
      setError("Couldn't save. Check the internet and try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const leagueOptions = data.leagues.map((l) => (
    <option key={l.handle} value={l.handle}>
      {l.title}
    </option>
  ));

  return (
    <Sheet label="Categories & leagues" width="narrow" onClose={onClose}>
      <header className="flex h-16 shrink-0 items-center gap-1 border-b border-hairline pr-3 pl-1 sm:pl-2">
        <IconButton label="Close" onClick={onClose}>
          <IconClose className="h-6 w-6" />
        </IconButton>
        <h2 className="text-[18px] font-medium text-ink">Categories & leagues</h2>
      </header>

      <div className="flex-1 space-y-12 overflow-y-auto px-4 py-6 sm:px-6" data-lenis-prevent>
        {error && <p className="text-[16px] font-medium text-ink">{error}</p>}

        <section>
          <Label>Categories</Label>
          <p className="-mt-1 mb-4 text-[14px] text-ink-dim">
            Each has its own page and a tile in the shop&apos;s Categories row. Put products in them from the product itself.
          </p>
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {data.categories.map((c) => {
              const n = inCategory(c.handle);
              return (
                <li key={c.handle} className="flex min-h-14 items-center gap-3 py-2">
                  <span className="flex-1 text-[16px] font-medium text-ink">{c.title}</span>
                  <span className={cn("text-[14px] tabular-nums", n ? "text-ink-dim" : "text-ink-dim/60")}>
                    {n ? `${n} product${n === 1 ? "" : "s"}` : "empty · hidden in the shop"}
                  </span>
                  {c.custom && (
                    <IconButton label={`Remove ${c.title}`} className="-mr-3" onClick={() => setRemoving(c.handle)}>
                      <IconTrash />
                    </IconButton>
                  )}
                </li>
              );
            })}
          </ul>
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await run("category", () => addCategoryAction(newCategory));
              if (res?.ok) {
                onData((d) => ({ ...d, categories: [...d.categories, res.category] }));
                setNewCategory("");
                onToast({ text: `${res.category.title} added. Put products in it from their sheet.` });
              } else if (res) setError(res.error);
            }}
          >
            <input
              className={inputClass}
              placeholder="New category — e.g. World Cup 2026"
              maxLength={40}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button tone="primary" type="submit" className="h-14" disabled={newCategory.trim().length < 2 || Boolean(busy)}>
              {busy === "category" ? <Spinner /> : <IconPlus />} Add
            </Button>
          </form>
        </section>

        <section>
          <Label>Leagues and their teams</Label>
          <p className="-mt-1 mb-4 text-[14px] text-ink-dim">
            Change a team&apos;s league to move it. A team shows in the shop once it has a product.
          </p>
          <div className="space-y-8">
            {data.leagues.map((l) => {
              const teams = data.teams.filter((t) => t.league === l.handle);
              return (
                <div key={l.handle}>
                  <h3 className="text-[18px] font-medium text-ink">
                    {l.title} <span className="text-[14px] font-normal text-ink-dim">· {teams.length} teams</span>
                  </h3>
                  {teams.length ? (
                    <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
                      {teams.map((t) => (
                        <li key={t.handle} className="flex min-h-14 items-center gap-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[16px] text-ink">{t.title}</span>
                            <span className="block text-[13px] text-ink-dim">
                              {inTeam(t.handle) ? `${inTeam(t.handle)} products` : "no products yet"}
                            </span>
                          </span>
                          {busy === t.handle && <Spinner />}
                          <select
                            aria-label={`League for ${t.title}`}
                            className="h-11 max-w-[11rem] border border-ink/25 bg-surface px-3 text-[15px] text-ink"
                            value={l.handle}
                            onChange={async (e) => {
                              const to = e.target.value;
                              const res = await run(t.handle, () => moveTeamAction(t.handle, to));
                              if (res?.ok) {
                                onData((d) => ({
                                  ...d,
                                  teams: d.teams.map((x) => (x.handle === t.handle ? { ...x, league: to } : x)),
                                }));
                                onToast({ text: `${t.title} is in ${data.leagues.find((x) => x.handle === to)?.title} now.` });
                              } else if (res) setError(res.error);
                            }}
                          >
                            {leagueOptions}
                          </select>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[15px] text-ink-dim">No teams yet.</p>
                  )}
                </div>
              );
            })}
            {data.teams.some((t) => !t.league) && (
              <div>
                <h3 className="text-[18px] font-medium text-ink">Not in a league</h3>
                <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
                  {data.teams
                    .filter((t) => !t.league)
                    .map((t) => (
                      <li key={t.handle} className="flex min-h-14 items-center gap-3 py-2">
                        <span className="flex-1 text-[16px] text-ink">{t.title}</span>
                        <select
                          aria-label={`League for ${t.title}`}
                          className="h-11 max-w-[11rem] border border-ink/25 bg-surface px-3 text-[15px] text-ink"
                          defaultValue=""
                          onChange={async (e) => {
                            const to = e.target.value;
                            const res = await run(t.handle, () => moveTeamAction(t.handle, to));
                            if (res?.ok)
                              onData((d) => ({
                                ...d,
                                teams: d.teams.map((x) => (x.handle === t.handle ? { ...x, league: to } : x)),
                              }));
                            else if (res) setError(res.error);
                          }}
                        >
                          <option value="" disabled>
                            Pick a league
                          </option>
                          {leagueOptions}
                        </select>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <form
            className="mt-8 border border-ink/15 bg-surface p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await run("team", () => addTeamAction(team.title, team.league));
              if (res?.ok) {
                onData((d) => ({ ...d, teams: [...d.teams, res.team] }));
                setTeam({ title: "", league: "" });
                onToast({ text: `${res.team.title} added.` });
              } else if (res) setError(res.error);
            }}
          >
            <p className="mb-3 text-[16px] font-medium text-ink">Add a team</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
              <input
                className={inputClass}
                placeholder="Team name — e.g. Napoli"
                maxLength={40}
                value={team.title}
                onChange={(e) => setTeam((t) => ({ ...t, title: e.target.value }))}
              />
              <select
                className={cn(inputClass, "appearance-none")}
                value={team.league}
                onChange={(e) => setTeam((t) => ({ ...t, league: e.target.value }))}
              >
                <option value="" disabled>
                  Which league?
                </option>
                {leagueOptions}
              </select>
            </div>
            <Button
              tone="primary"
              type="submit"
              className="mt-3 w-full"
              disabled={team.title.trim().length < 2 || !team.league || Boolean(busy)}
            >
              {busy === "team" ? <Spinner /> : <IconPlus />} Add team
            </Button>
          </form>

          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await run("league", () => addLeagueAction(newLeague));
              if (res?.ok) {
                onData((d) => {
                  const at = d.leagues.findIndex((l) => l.handle === "national-teams");
                  const leagues = [...d.leagues];
                  leagues.splice(at === -1 ? leagues.length : at, 0, res.league);
                  return { ...d, leagues };
                });
                setNewLeague("");
                onToast({ text: `${res.league.title} added. Move teams into it above.` });
              } else if (res) setError(res.error);
            }}
          >
            <input
              className={inputClass}
              placeholder="New league — e.g. Eredivisie"
              maxLength={40}
              value={newLeague}
              onChange={(e) => setNewLeague(e.target.value)}
            />
            <Button tone="primary" type="submit" className="h-14" disabled={newLeague.trim().length < 2 || Boolean(busy)}>
              {busy === "league" ? <Spinner /> : <IconPlus />} Add
            </Button>
          </form>
        </section>
      </div>

      {removing && (
        <Dialog
          title={`Remove ${data.categories.find((c) => c.handle === removing)?.title}?`}
          onClose={() => setRemoving(null)}
          actions={
            <>
              <Button tone="outline" onClick={() => setRemoving(null)}>
                Keep it
              </Button>
              <Button
                tone="danger"
                disabled={Boolean(busy)}
                onClick={async () => {
                  const handle = removing;
                  const res = await run("remove", () => removeCategoryAction(handle));
                  setRemoving(null);
                  if (res?.ok)
                    onData((d) => ({
                      ...d,
                      categories: d.categories.filter((c) => c.handle !== handle),
                      products: d.products.map((p) =>
                        p.categories?.includes(handle) ? { ...p, categories: p.categories.filter((h) => h !== handle) } : p,
                      ),
                    }));
                  else if (res) setError(res.error);
                }}
              >
                Remove
              </Button>
            </>
          }
        >
          Its page goes away. The products in it stay in the shop.
        </Dialog>
      )}
    </Sheet>
  );
}
