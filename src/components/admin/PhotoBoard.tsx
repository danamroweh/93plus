"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminPhoto } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Button, IconCamera, IconPlus, IconTrash, Spinner } from "./parts";

/**
 * Photos as slots, not a list: Front (the shop's grid picture), Back (where
 * a name and number get previewed) and More. The hover frame our studio
 * shoots carry is handled out of sight — it's the front, recoloured, so it
 * stays while the front stays and goes when the front is replaced.
 */

export type Slots = {
  front: AdminPhoto | null;
  back: AdminPhoto | null;
  hover: AdminPhoto | null;
  more: AdminPhoto[];
};

export function toSlots(photos: AdminPhoto[]): Slots {
  const front = photos.find((p) => p.role === "front") ?? photos.find((p) => !p.role) ?? null;
  const hover = photos.find((p) => p.role === "hover") ?? null;
  const rest = photos.filter((p) => p !== front && p !== hover);
  // A two-photo product's second frame is its back.
  const back = rest.find((p) => p.role === "back") ?? rest.find((p) => !p.role) ?? null;
  return { front, back, hover, more: rest.filter((p) => p !== back) };
}

export function fromSlots(s: Slots, originalFront: string | null): AdminPhoto[] {
  const keepHover = s.hover && s.front && s.front.url === originalFront;
  return [
    ...(s.front ? [{ ...s.front, role: "front" as const }] : []),
    ...(keepHover ? [s.hover!] : []),
    ...(s.back ? [{ ...s.back, role: "back" as const }] : []),
    ...s.more.map((p) => ({ ...p, role: "detail" as const })),
  ];
}

/** Phones take 12-megapixel photos; the shop needs 864 px. Shrink before sending. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9));
  } catch {
    return file; // the server tries the original
  }
}

export async function uploadPhoto(file: File): Promise<AdminPhoto> {
  const form = new FormData();
  form.append("photo", await shrink(file), "photo.jpg");
  const res = await fetch("/admin/upload", { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as
    | { ok: true; photo: AdminPhoto }
    | { ok: false; error: string }
    | null;
  if (!body?.ok) throw new Error(body && !body.ok ? body.error : "The upload didn't go through. Try again.");
  return body.photo;
}

type SlotId = "front" | "back" | number;

const slotName = (id: SlotId) => (id === "front" ? "Front" : id === "back" ? "Back" : `Photo ${id + 3}`);

export function PhotoBoard({
  slots,
  onChange,
  onBusy,
  onError,
  showBack,
}: {
  slots: Slots;
  onChange: (s: Slots) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  /** Accessories have no back to print on; their second photo is just a photo. */
  showBack: boolean;
}) {
  const [selected, setSelected] = useState<SlotId>("front");
  const [pending, setPending] = useState<Partial<Record<string, string>>>({});
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const target = useRef<SlotId | "add">("front");
  // The latest slots, for uploads that finish after other edits.
  const latest = useRef(slots);
  useEffect(() => {
    latest.current = slots;
  });

  const photoAt = (id: SlotId) =>
    id === "front" ? slots.front : id === "back" ? slots.back : (slots.more[id] ?? null);

  const ids: SlotId[] = ["front", ...(showBack ? (["back"] as const) : []), ...slots.more.map((_, i) => i)];
  const current = photoAt(selected);
  const busyKey = (id: SlotId | "add") => String(id);

  async function put(id: SlotId | "add", file: File) {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      onError("That's not a photo.");
      return;
    }
    const slot: SlotId =
      id === "add" ? (!showBack || latest.current.back ? latest.current.more.length : "back") : id;
    const key = busyKey(slot);
    const local = URL.createObjectURL(file);
    setPending((p) => ({ ...p, [key]: local }));
    if (id === "add" && typeof slot === "number")
      onChange({ ...latest.current, more: [...latest.current.more, { url: "", preview: local }] });
    setSelected(slot);
    onBusy(true);
    try {
      const photo = await uploadPhoto(file);
      const s = latest.current;
      if (slot === "front") onChange({ ...s, front: photo });
      else if (slot === "back") onChange({ ...s, back: photo });
      else onChange({ ...s, more: s.more.map((p, i) => (i === slot ? photo : p)) });
    } catch (err) {
      onError(err instanceof Error ? err.message : "The upload didn't go through.");
      if (typeof slot === "number" && id === "add") {
        const s = latest.current;
        onChange({ ...s, more: s.more.filter((_, i) => i !== slot) });
        setSelected("front");
      }
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      URL.revokeObjectURL(local);
      onBusy(false);
    }
  }

  function remove(id: SlotId) {
    if (id === "front") onChange({ ...slots, front: null });
    else if (id === "back") onChange({ ...slots, back: null });
    else {
      onChange({ ...slots, more: slots.more.filter((_, i) => i !== id) });
      setSelected("front");
    }
  }

  function choose(id: SlotId | "add") {
    target.current = id;
    picker.current?.click();
  }

  const shown = pending[busyKey(selected)] ?? current?.preview;
  const uploading = Boolean(pending[busyKey(selected)]);

  return (
    <div>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void put(target.current, file);
        }}
      />

      {/* The big one */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void put(selected, file);
        }}
        className={cn(
          "relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden bg-panel sm:max-w-[420px] lg:max-w-none",
          over && "ring-4 ring-ink ring-inset",
        )}
      >
        {shown ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={shown}
            alt={slotName(selected)}
            className={cn("h-full w-full object-cover transition-opacity", uploading && "opacity-60")}
            style={current?.blur ? { backgroundImage: `url(${current.blur})`, backgroundSize: "cover" } : undefined}
          />
        ) : (
          <button
            type="button"
            onClick={() => choose(selected)}
            className="flex h-full w-full flex-col items-center justify-center gap-4 border-2 border-dashed border-ink/30 text-ink transition-colors hover:border-ink hover:bg-ink/[0.04]"
          >
            <IconCamera className="h-12 w-12" />
            <span className="text-[18px] font-medium">Add the {slotName(selected).toLowerCase()} photo</span>
            <span className="text-[14px] text-ink-dim">Tap here, or drop a photo</span>
          </button>
        )}
        <span className="pointer-events-none absolute top-3 left-3 bg-ground/90 px-2.5 py-1 text-[12px] font-medium uppercase tracking-[0.06em] text-ink">
          {slotName(selected)}
        </span>
        {uploading && (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-ground/90 py-3 text-[15px] text-ink">
            <Spinner /> Uploading…
          </span>
        )}
      </div>

      {shown && !uploading && (
        <div className="mx-auto mt-3 flex max-w-[420px] gap-2 lg:max-w-none">
          <Button className="flex-1" onClick={() => choose(selected)}>
            <IconCamera /> Change photo
          </Button>
          <Button tone="quiet" onClick={() => remove(selected)} aria-label={`Remove the ${slotName(selected)} photo`}>
            <IconTrash /> Remove
          </Button>
        </div>
      )}

      {/* The row of slots */}
      <div className="mx-auto mt-4 flex max-w-[420px] flex-wrap justify-center gap-2 lg:max-w-none lg:justify-start">
        {ids.map((id) => {
          const photo = photoAt(id);
          const src = pending[busyKey(id)] ?? photo?.preview;
          return (
            <button
              key={String(id)}
              type="button"
              onClick={() => setSelected(id)}
              aria-label={slotName(id)}
              aria-pressed={selected === id}
              className="group w-[68px] text-center"
            >
              <span
                className={cn(
                  "relative block aspect-[3/4] overflow-hidden border-2 bg-panel",
                  selected === id ? "border-ink" : "border-transparent group-hover:border-ink/30",
                )}
              >
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-ink-dim">
                    <IconPlus />
                  </span>
                )}
                {pending[busyKey(id)] && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ground/50 text-ink">
                    <Spinner />
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[12px] font-medium uppercase tracking-[0.04em] text-ink-dim">
                {slotName(id)}
              </span>
            </button>
          );
        })}
        {slots.more.length < 5 && (
          <button type="button" onClick={() => choose("add")} className="group w-[68px] text-center" aria-label="Add another photo">
            <span className="flex aspect-[3/4] items-center justify-center border-2 border-dashed border-ink/25 text-ink transition-colors group-hover:border-ink">
              <IconPlus />
            </span>
            <span className="mt-1 block text-[12px] font-medium uppercase tracking-[0.04em] text-ink-dim">Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
