import { cn } from "@/lib/utils";

/**
 * Wordmark. The ball glyph is drawn rather than imported so there is no icon
 * request on first paint and it inherits the red primary token.
 */
export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = {
    sm: "size-7",
    md: "size-9",
    lg: "size-12",
  }[size];

  const text = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "grid place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25",
          dimensions,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-[62%]" fill="none">
          <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7.4 15.2 9.7 14 13.5h-4L8.8 9.7 12 7.4Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <span className={cn("font-semibold tracking-tight", text)}>
        FIFA<span className="text-primary">Tracker</span>
      </span>
    </div>
  );
}
