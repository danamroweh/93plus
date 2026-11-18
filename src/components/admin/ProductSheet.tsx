"use client";

import { useMemo, useRef, useState } from "react";
import type { Item, Kit } from "@/lib/commerce/catalogue";
import {
  autoCategories,
  hasVersions,
  type AdminCategory,
  type AdminProduct,
  type AdminSnapshot,
  type AdminTeam,
  type ProductInput,
  type Stock,
} from "@/lib/admin/types";
import { addCategoryAction, addTeamAction, deleteProductAction, saveProductAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import {
  Button,
  Dialog,
  IconAlert,
  IconButton,
  IconCheck,
  IconClose,
  IconKeychain,
  IconLongSleeve,
  IconMug,
  IconOut,
  IconPillow,
  IconPlus,
  IconRetro,
  IconShirt,
  IconTracksuit,
  IconTrash,
  Label,
  PriceInput,
  Segmented,
  Sheet,
  Spinner,
  Switch,
  inputClass,
  money,
} from "./parts";
import { PhotoBoard, fromSlots, toSlots, type Slots } from "./PhotoBoard";
import { StockEditor } from "./StockEditor";

type TypeId = "Shirt" | "Retro" | "Long sleeve" | "Tracksuit" | Item;

const TYPES: { id: TypeId; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "Shirt", label: "Shirt", Icon: IconShirt },
  { id: "Retro", label: "Retro", Icon: IconRetro },
  { id: "Long sleeve", label: "Long sleeve", Icon: IconLongSleeve },
  { id: "Tracksuit", label: "Tracksuit", Icon: IconTracksuit },
  { id: "Keychain", label: "Keychain", Icon: IconKeychain },
  { id: "Mug", label: "Mug", Icon: IconMug },
  { id: "Pillow", label: "Pillow", Icon: IconPillow },
];

type Draft = {
  kind: "shirt" | "printable";
  kit: Kit | null;
  item: Item | null;
  team: string | null;
  title: string;
  description: string;
  fan: number | null;
  player: number | null;
  cents: number | null;
  stock: Stock;
  hidden: boolean;
  slots: Slots;
  /** null: follow the type. */
  categories: string[] | null;
};

const typeOf = (d: Pick<Draft, "kind" | "kit" | "item">): TypeId =>
  d.kind === "printable" ? (d.item ?? "Keychain") : hasVersions(d.kit) ? "Shirt" : (d.kit as TypeId);

function draftOf(p: AdminProduct): Draft {
  return {
    kind: p.kind,
    kit: p.kit,
    item: p.item,
    team: p.team,
    title: p.title,
    description: p.description,
    fan: p.fan,
    player: p.player,
    cents: p.cents,
    stock: p.stock,
    hidden: p.hidden,
    slots: toSlots(p.photos),
    categories: p.categories,
  };
}

function blankDraft(data: AdminSnapshot): Draft {
  return {
    kind: "shirt",
    kit: "Home",
    item: null,
    team: null,
    title: "",
    description: "",
    fan: data.defaults.Home.fan,
    player: data.defaults.Home.player ?? null,
    cents: null,
    stock: { track: false },
    hidden: false,
    slots: { front: null, back: null, hover: null, more: [] },
    categories: null,
  };
}

function autoName(d: Draft, teams: AdminTeam[], season: string) {
  const team = teams.find((t) => t.handle === d.team)?.title ?? "";
  const parts =
    d.kind === "printable"
      ? [team, d.item]
      : d.kit === "Retro"
        ? [team, "Retro"]
        : d.kit === "Long sleeve"
          ? [team, "Long Sleeve", season]
          : d.kit === "Tracksuit"
            ? [team, "Tracksuit", season]
            : [team, d.kit, season];
  return parts.filter(Boolean).join(" ");
}

export function ProductSheet({
  product,
  data,
  onClose,
  onSaved,
  onDeleted,
  onTeamAdded,
  onCategoryAdded,
}: {
  product: AdminProduct | null;
  data: AdminSnapshot;
  onClose: () => void;
  onSaved: (p: AdminProduct, isNew: boolean) => void;
  onDeleted: (p: AdminProduct) => void;
  onTeamAdded: (t: AdminTeam) => void;
  onCategoryAdded: (c: AdminCategory) => void;
}) {
  const isNew = !product;
  const initial = useMemo(() => (product ? draftOf(product) : blankDraft(data)), [product, data]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [nameTouched, setNameTouched] = useState(!isNew);
  const [pricesTouched, setPricesTouched] = useState(!isNew);
  const [uploads, setUploads] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | "delete" | "leave" | "team" | "category">(null);
  const [showMore, setShowMore] = useState(isNew);

  const originalFront = initial.slots.front?.url ?? null;
  const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(initial);
  const busy = saving || uploads > 0;

  // A team added from this sheet names the product before the page's list catches up.
  const addedTeams = useRef<AdminTeam[]>([]);
  const [addedCategories, setAddedCategories] = useState<AdminCategory[]>([]);

  const set = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (!nameTouched) next.title = autoName(next, [...data.teams, ...addedTeams.current], data.season);
      return next;
    });
  };

  const setType = (id: TypeId) => {
    const printable = id === "Keychain" || id === "Mug" || id === "Pillow";
    applyType(
      printable ? null : id === "Shirt" ? (hasVersions(draft.kit) ? draft.kit : "Home") : (id as Kit),
      printable ? (id as Item) : null,
    );
  };

  /** A new kind of product: prices follow (unless typed), stock resets if its sizes changed. */
  const applyType = (kit: Kit | null, item: Item | null) => {
    const printable = Boolean(item);
    const base = data.defaults[(kit ?? item)!];
    const sameSlots =
      (printable && draft.kind === "printable") ||
      (!printable && draft.kind === "shirt" && hasVersions(kit) === hasVersions(draft.kit));
    set({
      kind: printable ? "printable" : "shirt",
      kit,
      item,
      ...(!pricesTouched && {
        fan: printable ? null : base.fan,
        player: hasVersions(kit) ? (base.player ?? null) : null,
        cents: printable ? base.fan : null,
      }),
      ...(pricesTouched && {
        fan: printable ? null : (draft.fan ?? draft.cents ?? base.fan),
        player: hasVersions(kit) ? (draft.player ?? base.player ?? null) : null,
        cents: printable ? (draft.cents ?? draft.fan ?? base.fan) : null,
      }),
      ...(!sameSlots && { stock: { track: false } as Stock }),
    });
  };

  const requestClose = () => {
    if (busy) return;
    if (!isNew && dirty) setAsk("leave");
    else if (isNew && (draft.slots.front || nameTouched)) setAsk("leave");
    else onClose();
  };

  async function save() {
    if (busy) return;
    if (draft.title.trim().length < 2) {
      setError("Give it a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: ProductInput = {
      handle: product?.handle ?? null,
      kind: draft.kind,
      title: draft.title,
      description: draft.description,
      team: draft.team,
      kit: draft.kit,
      item: draft.item,
      fan: draft.fan,
      player: draft.player,
      cents: draft.cents,
      stock: draft.stock,
      hidden: draft.hidden,
      photos: fromSlots(draft.slots, originalFront).map(({ url, role }) => ({ url, ...(role && { role }) })),
      categories: draft.categories,
    };
    try {
      const res = await saveProductAction(input);
      if (!res.ok) setError(res.error);
      else onSaved(res.product, isNew);
    } catch {
      setError("Couldn't save. Check the internet and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!product) return;
    setSaving(true);
    try {
      const res = await deleteProductAction(product.handle);
      if (!res.ok) setError(res.error);
      else onDeleted(product);
    } catch {
      setError("Couldn't delete. Check the internet and try again.");
    } finally {
      setSaving(false);
      setAsk(null);
    }
  }

  const type = typeOf(draft);
  const versions = draft.kind === "shirt" && hasVersions(draft.kit);
  const printingNote =
    draft.kind === "printable"
      ? null
      : draft.kit === "Retro"
        ? "Name & number printing is included."
        : `Name & number printing adds ${money(data.printing)}.`;

  const allCategories = [
    ...data.categories,
    ...addedCategories.filter((c) => !data.categories.some((x) => x.handle === c.handle)),
  ];
  const shownIn = draft.categories ?? autoCategories({ ...draft, ucl: product?.ucl }, data.rules);
  const teamInfo = data.teams.find((t) => t.handle === draft.team);
  const leagueTitle = data.leagues.find((l) => l.handle === teamInfo?.league)?.title;
  const leagueLine = !draft.team
    ? "No team — it won't have a team page."
    : leagueTitle
      ? `On the ${teamInfo?.title} page, in ${leagueTitle}.`
      : `On the ${teamInfo?.title} page. The team isn't in a league yet (⋯ → Categories & leagues).`;

  const teamSelect = (
    <TeamSelect
      value={draft.team}
      data={data}
      onChange={(team) => set({ team })}
      onNew={() => setAsk("team")}
    />
  );

  return (
    <Sheet onClose={requestClose} label={isNew ? "New product" : product.title}>
      <header className="flex h-16 shrink-0 items-center gap-1 border-b border-hairline pr-3 pl-1 sm:pl-2">
        <IconButton label="Close" onClick={requestClose}>
          <IconClose className="h-6 w-6" />
        </IconButton>
        <h2 className="min-w-0 flex-1 truncate text-[18px] font-medium text-ink">
          {isNew ? "New product" : draft.title || "Untitled"}
        </h2>
        {!isNew && !product.hidden && !product.deleted && (
          <a
            href={`/product/${product.handle}`}
            target="_blank"
            rel="noreferrer"
            className="hidden h-11 items-center gap-2 px-3 text-[14px] font-medium uppercase tracking-[0.04em] text-ink-dim hover:text-ink sm:inline-flex"
          >
            See it in the shop <IconOut className="h-4 w-4" />
          </a>
        )}
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
        {isNew && (
          <div className="border-b border-hairline px-4 pt-6 pb-8 sm:px-6 lg:px-8">
            <Label>What are you adding?</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {TYPES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={type === id}
                  onClick={() => setType(id)}
                  className={cn(
                    "flex h-24 flex-col items-center justify-center gap-2 border text-[14px] font-medium transition-colors",
                    type === id
                      ? "border-ink bg-ink text-ground"
                      : "border-ink/25 bg-surface text-ink hover:border-ink",
                  )}
                >
                  <Icon className="h-8 w-8" />
                  {label}
                </button>
              ))}
            </div>
            {type === "Shirt" && (
              <div className="mt-3 max-w-[420px]">
                <Segmented
                  label="Which kit"
                  value={(draft.kit ?? "Home") as "Home" | "Away" | "Third"}
                  onChange={(kit) => set({ kit })}
                  options={[
                    { value: "Home", label: "Home" },
                    { value: "Away", label: "Away" },
                    { value: "Third", label: "Third" },
                  ]}
                />
              </div>
            )}
            <div className="mt-8 max-w-[420px]">
              <Label>Team</Label>
              {teamSelect}
            </div>
          </div>
        )}

        <div className="grid gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-8">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <PhotoBoard
              slots={draft.slots}
              onChange={(slots) => setDraft((d) => ({ ...d, slots }))}
              onBusy={(b) => setUploads((n) => Math.max(0, n + (b ? 1 : -1)))}
              onError={setError}
              showBack={draft.kind === "shirt"}
            />
          </div>

          <div className="min-w-0 space-y-10 pb-8">
            <section>
              <Label>Name</Label>
              <input
                className={cn(inputClass, "h-16 text-[20px] font-medium")}
                value={draft.title}
                maxLength={80}
                placeholder="e.g. Napoli Home 26/27"
                onChange={(e) => {
                  setNameTouched(true);
                  setError(null);
                  setDraft((d) => ({ ...d, title: e.target.value }));
                }}
              />
            </section>

            {!isNew && (
              <section className="flex items-center justify-between gap-4 border border-ink/15 bg-surface px-4 py-4">
                <div>
                  <p className="text-[17px] font-medium text-ink">Show in the shop</p>
                  <p className="mt-0.5 text-[14px] text-ink-dim">
                    {draft.hidden ? "Hidden — customers can't see it." : "Customers can see it and buy it."}
                  </p>
                </div>
                <Switch label="Show in the shop" checked={!draft.hidden} onChange={(v) => set({ hidden: !v })} />
              </section>
            )}

            <section>
              <Label aside={printingNote}>Price</Label>
              {versions ? (
                <div className="space-y-3">
                  <PriceRow label="Fan" hint="the regular shirt">
                    <PriceInput
                      label="Fan price"
                      cents={draft.fan ?? 0}
                      onChange={(fan) => {
                        setPricesTouched(true);
                        set({ fan });
                      }}
                    />
                  </PriceRow>
                  <PriceRow label="Player" hint="the match version">
                    <PriceInput
                      label="Player price"
                      cents={draft.player ?? 0}
                      onChange={(player) => {
                        setPricesTouched(true);
                        set({ player });
                      }}
                    />
                  </PriceRow>
                </div>
              ) : (
                <PriceInput
                  label="Price"
                  cents={(draft.kind === "printable" ? draft.cents : draft.fan) ?? 0}
                  onChange={(c) => {
                    setPricesTouched(true);
                    set(draft.kind === "printable" ? { cents: c } : { fan: c });
                  }}
                />
              )}
            </section>

            <StockEditor
              stock={draft.stock}
              kind={draft.kind}
              kit={draft.kit}
              onChange={(stock) => set({ stock })}
            />

            {isNew && (
              <section className="flex items-center justify-between gap-4 border border-ink/15 bg-surface px-4 py-4">
                <div>
                  <p className="text-[17px] font-medium text-ink">Show in the shop</p>
                  <p className="mt-0.5 text-[14px] text-ink-dim">
                    {draft.hidden ? "It'll be saved, hidden from customers." : "It goes live as soon as you add it."}
                  </p>
                </div>
                <Switch label="Show in the shop" checked={!draft.hidden} onChange={(v) => set({ hidden: !v })} />
              </section>
            )}

            <section>
              <Label
                aside={
                  draft.categories && (
                    <button
                      type="button"
                      onClick={() => set({ categories: null })}
                      className="underline-offset-4 hover:text-ink hover:underline"
                    >
                      Match the type again
                    </button>
                  )
                }
              >
                Where it shows in the shop
              </Label>
              {!isNew && (
                <div className="mb-5">
                  {teamSelect}
                  <p className="mt-2 text-[14px] text-ink-dim">{leagueLine}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {allCategories.map((c) => {
                  const on = shownIn.includes(c.handle);
                  return (
                    <button
                      key={c.handle}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set({ categories: on ? shownIn.filter((h) => h !== c.handle) : [...shownIn, c.handle] })
                      }
                      className={cn(
                        "flex h-11 items-center gap-2 border px-4 text-[15px] font-medium transition-colors",
                        on ? "border-ink bg-ink text-ground" : "border-ink/25 bg-surface text-ink hover:border-ink",
                      )}
                    >
                      {on && <IconCheck className="h-4 w-4" />}
                      {c.title}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAsk("category")}
                  className="flex h-11 items-center gap-2 border border-dashed border-ink/35 px-4 text-[15px] font-medium text-ink hover:border-ink"
                >
                  <IconPlus className="h-4 w-4" /> New category
                </button>
              </div>
              <p className="mt-3 text-[14px] text-ink-dim">
                {shownIn.length
                  ? draft.categories
                    ? "Picked by hand. Tap to add or take away."
                    : "Picked from its type. Tap to change."
                  : "In no category — it only shows on its team page and in search."}
              </p>
            </section>

            <section>
              {!showMore ? (
                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  className="h-12 text-[14px] font-medium uppercase tracking-[0.04em] text-ink-dim underline-offset-4 hover:text-ink hover:underline"
                >
                  More details — type, description
                </button>
              ) : (
                <div className="space-y-8">
                  {!isNew && (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <Label>Type</Label>
                        <select
                          className={cn(inputClass, "appearance-none")}
                          value={draft.kind === "printable" ? draft.item! : draft.kit!}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (draft.kind === "printable") applyType(null, v as Item);
                            else applyType(v as Kit, null);
                          }}
                        >
                          {(draft.kind === "printable"
                            ? ["Keychain", "Mug", "Pillow"]
                            : ["Home", "Away", "Third", "Retro", "Long sleeve", "Tracksuit"]
                          ).map((v) => (
                            <option key={v} value={v}>
                              {draft.kind === "shirt" && hasVersions(v as Kit) ? `${v} kit` : v}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label aside={`${draft.description.length}/400`}>Description</Label>
                    <textarea
                      className={cn(inputClass, "h-32 resize-none py-3 leading-snug")}
                      maxLength={400}
                      value={draft.description}
                      placeholder={isNew ? "Optional — one line about it." : ""}
                      onChange={(e) => set({ description: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-hairline bg-ground px-3 py-3 sm:px-6">
        {error && (
          <p role="alert" className="mb-3 flex items-center gap-2 text-[16px] font-medium text-ink">
            <IconAlert /> {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button tone="quiet" onClick={() => setAsk("delete")} disabled={busy} className="px-3">
              <IconTrash /> Delete
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {uploads > 0 && <span className="mr-2 hidden text-[14px] text-ink-dim sm:inline">Waiting for the photo…</span>}
            {dirty && !isNew && (
              <Button tone="quiet" onClick={() => setDraft(initial)} disabled={busy} className="px-3">
                Undo
              </Button>
            )}
            {dirty ? (
              <Button tone="primary" size="lg" onClick={save} disabled={busy} className="min-w-[120px] sm:min-w-[150px]">
                {saving && <Spinner />}
                {isNew ? "Add to shop" : "Save"}
              </Button>
            ) : (
              <Button tone="primary" size="lg" onClick={onClose} className="min-w-[120px] sm:min-w-[150px]">
                Done
              </Button>
            )}
          </div>
        </div>
      </footer>

      {ask === "delete" && product && (
        <Dialog
          title={`Delete ${product.title}?`}
          onClose={() => setAsk(null)}
          actions={
            <>
              <Button tone="outline" onClick={() => setAsk(null)}>
                Keep it
              </Button>
              <Button tone="danger" onClick={remove} disabled={saving}>
                {saving && <Spinner />} Delete
              </Button>
            </>
          }
        >
          It leaves the shop straight away. You can bring it back from <b className="font-medium text-ink">Deleted products</b>.
        </Dialog>
      )}

      {ask === "leave" && (
        <Dialog
          title={isNew ? "Leave without adding it?" : "Save your changes?"}
          onClose={() => setAsk(null)}
          actions={
            isNew ? (
              <>
                <Button tone="outline" onClick={() => setAsk(null)}>
                  Keep going
                </Button>
                <Button tone="danger" onClick={onClose}>
                  Leave
                </Button>
              </>
            ) : (
              <>
                <Button tone="outline" onClick={onClose}>
                  Don&apos;t save
                </Button>
                <Button
                  tone="primary"
                  onClick={() => {
                    setAsk(null);
                    void save();
                  }}
                >
                  Save
                </Button>
              </>
            )
          }
        >
          {isNew ? "What you've filled in will be lost." : "You changed this product but haven't saved it."}
        </Dialog>
      )}

      {ask === "category" && (
        <NewCategory
          onClose={() => setAsk(null)}
          onAdded={(c) => {
            setAddedCategories((list) => [...list, c]);
            onCategoryAdded(c);
            setAsk(null);
            set({ categories: [...shownIn, c.handle] });
          }}
        />
      )}

      {ask === "team" && (
        <NewTeam
          leagues={data.leagues}
          onClose={() => setAsk(null)}
          onAdded={(team) => {
            addedTeams.current.push(team);
            onTeamAdded(team);
            setAsk(null);
            set({ team: team.handle });
          }}
        />
      )}
    </Sheet>
  );
}

function PriceRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        <p className="text-[17px] font-medium text-ink">{label}</p>
        <p className="text-[14px] text-ink-dim">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function TeamSelect({
  value,
  data,
  onChange,
  onNew,
}: {
  value: string | null;
  data: AdminSnapshot;
  onChange: (team: string | null) => void;
  onNew: () => void;
}) {
  const loose = data.teams.filter((t) => !t.league);
  return (
    <select
      className={cn(inputClass, "appearance-none bg-[length:20px] bg-[right_1rem_center] bg-no-repeat pr-12")}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239c1305' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new") onNew();
        else onChange(e.target.value || null);
      }}
    >
      <option value="">No team</option>
      {data.leagues.map((l) => {
        const teams = data.teams.filter((t) => t.league === l.handle);
        return teams.length ? (
          <optgroup key={l.handle} label={l.title}>
            {teams.map((t) => (
              <option key={t.handle} value={t.handle}>
                {t.title}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
      {loose.length > 0 && (
        <optgroup label="Other">
          {loose.map((t) => (
            <option key={t.handle} value={t.handle}>
              {t.title}
            </option>
          ))}
        </optgroup>
      )}
      <option value="__new">+ Add a new team…</option>
    </select>
  );
}

function NewTeam({
  leagues,
  onClose,
  onAdded,
}: {
  leagues: AdminSnapshot["leagues"];
  onClose: () => void;
  onAdded: (t: AdminTeam) => void;
}) {
  const [title, setTitle] = useState("");
  const [league, setLeague] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function add() {
    setSaving(true);
    try {
      const res = await addTeamAction(title, league);
      if (res.ok) onAdded(res.team);
      else setError(res.error);
    } catch {
      setError("Couldn't add it. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Add a new team"
      onClose={onClose}
      actions={
        <>
          <Button tone="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" onClick={add} disabled={saving || title.trim().length < 2 || !league}>
            {saving && <Spinner />} Add team
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-ink">
        <input
          autoFocus
          className={inputClass}
          placeholder="Team name — e.g. Napoli"
          value={title}
          maxLength={40}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
        />
        <select className={cn(inputClass, "appearance-none")} value={league} onChange={(e) => setLeague(e.target.value)}>
          <option value="" disabled>
            Which league?
          </option>
          {leagues.map((l) => (
            <option key={l.handle} value={l.handle}>
              {l.title}
            </option>
          ))}
        </select>
        {error && <p className="text-[15px] font-medium text-ink">{error}</p>}
      </div>
    </Dialog>
  );
}

function NewCategory({ onClose, onAdded }: { onClose: () => void; onAdded: (c: AdminCategory) => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function add() {
    setSaving(true);
    try {
      const res = await addCategoryAction(title);
      if (res.ok) onAdded(res.category);
      else setError(res.error);
    } catch {
      setError("Couldn't add it. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Add a new category"
      onClose={onClose}
      actions={
        <>
          <Button tone="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" onClick={add} disabled={saving || title.trim().length < 2}>
            {saving && <Spinner />} Add category
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-ink">
        <input
          autoFocus
          className={inputClass}
          placeholder="e.g. World Cup 2026, Kids, Sale"
          value={title}
          maxLength={40}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && title.trim().length >= 2 && void add()}
        />
        <p className="text-[14px] text-ink-dim">It gets its own page and shows in the shop&apos;s Categories row once a product is in it.</p>
        {error && <p className="text-[15px] font-medium text-ink">{error}</p>}
      </div>
    </Dialog>
  );
}
