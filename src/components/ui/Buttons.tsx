import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Small actions that have to read as buttons on a phone — "Return to shop",
 * "Size guide", "Remove". At 11px uppercase with only a hover underline they
 * looked like captions, and touch has no hover to give them away. A boxed
 * outline at the same type size makes them obvious without making them big.
 */
const box =
  "t-label inline-flex min-h-10 items-center gap-2 border border-ink/35 px-3.5 text-ink transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-ground active:bg-ink active:text-ground";

export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="10"
      viewBox="0 0 15 10"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path d="M9.5.7 13.8 5 9.5 9.3M13.4 5H0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function BackLink({
  href = "/",
  children = "Back to shop",
  className,
}: {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(box, className)}>
      <Arrow className="rotate-180" />
      {children}
    </Link>
  );
}

export function ChipLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(box, className)}>
      {children}
    </Link>
  );
}

export function ChipButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return <button type="button" className={cn(box, className)} {...props} />;
}

/**
 * − 1 + with thumb-sized targets. The old glyph-only buttons were ~10px wide,
 * so a tap on a phone usually missed. Each is now a full 44px square.
 */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  size = "md",
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "md" | "sm";
  disabled?: boolean;
}) {
  const cell = size === "md" ? "h-[50px] w-12" : "h-11 w-11";
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <div className="t-label flex shrink-0 items-center border border-hairline">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => step(-1)}
        className={cn(
          cell,
          "flex items-center justify-center text-lg transition-colors duration-100 hover:bg-panel active:bg-panel disabled:opacity-30",
        )}
      >
        &minus;
      </button>
      <span className="min-w-7 text-center text-base tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => step(1)}
        className={cn(
          cell,
          "flex items-center justify-center text-lg transition-colors duration-100 hover:bg-panel active:bg-panel disabled:opacity-30",
        )}
      >
        +
      </button>
    </div>
  );
}
