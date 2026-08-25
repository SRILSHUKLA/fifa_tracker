"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SCORE = 99;

const SIZES = {
  default: {
    gap: "gap-2",
    button: "size-11",
    icon: "size-5",
    input: "w-14 text-4xl",
  },
  // Used inside the narrow league-fixture dialog (components/leagues/
  // log-fixture-result-dialog.tsx) — two of these sit side by side in a
  // small modal, unlike the full-width page the default size is built for.
  compact: {
    gap: "gap-1.5",
    button: "size-9",
    icon: "size-4",
    input: "w-10 text-2xl",
  },
} as const;

/**
 * Score input built for thumbs: two large tap targets and a big number, with
 * the raw field still editable for the occasional 11–0.
 *
 * Deliberately not a plain <input type="number"> alone — on a console sofa,
 * summoning the numeric keyboard for "2" is more work than tapping twice.
 */
export function ScoreStepper({
  label,
  value,
  onChange,
  highlight = false,
  size = "default",
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  /** Tints the number red — used to mark the current leader. */
  highlight?: boolean;
  size?: keyof typeof SIZES;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(MAX_SCORE, n));
  const dims = SIZES[size];

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="max-w-[9rem] truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <div className={cn("flex items-center", dims.gap)}>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Decrease ${label} score`}
          disabled={value <= 0}
          onClick={() => onChange(clamp(value - 1))}
          className={cn(dims.button, "rounded-full")}
        >
          <Minus className={dims.icon} />
        </Button>

        <input
          type="number"
          inputMode="numeric"
          aria-label={`${label} score`}
          value={value}
          min={0}
          max={MAX_SCORE}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            onChange(Number.isNaN(parsed) ? 0 : clamp(parsed));
          }}
          onFocus={(event) => event.target.select()}
          className={cn(
            "no-spinner tnum bg-transparent text-center font-bold outline-none",
            dims.input,
            highlight ? "text-primary" : "text-foreground",
          )}
        />

        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Increase ${label} score`}
          disabled={value >= MAX_SCORE}
          onClick={() => onChange(clamp(value + 1))}
          className={cn(dims.button, "rounded-full")}
        >
          <Plus className={dims.icon} />
        </Button>
      </div>
    </div>
  );
}
