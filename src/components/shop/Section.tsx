import { cn } from "@/lib/utils";

/**
 * Section label. Deliberately the quietest tone on the page — it's a
 * signpost, not content, and at 11px it needs to recede without becoming
 * illegible. That's what ink-dim's low saturation buys.
 */
export function SectionHeader({
  label,
  aside,
  className,
}: {
  label: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex items-baseline justify-between border-t border-hairline pt-4",
        className,
      )}
    >
      <h2 className="t-meta text-ink-dim">{label}</h2>
      {aside && <span className="t-meta text-ink-dim">{aside}</span>}
    </div>
  );
}
