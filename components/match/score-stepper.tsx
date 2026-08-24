"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SCORE = 99;

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
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  /** Tints the number red — used to mark the current leader. */
  highlight?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(MAX_SCORE, n));

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="max-w-[9rem] truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Decrease ${label} score`}
          disabled={value <= 0}
          onClick={() => onChange(clamp(value - 1))}
          className="size-11 rounded-full"
        >
          <Minus className="size-5" />
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
            "no-spinner tnum w-14 bg-transparent text-center text-4xl font-bold outline-none",
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
          className="size-11 rounded-full"
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
