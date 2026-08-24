import { cn } from "@/lib/utils";

/**
 * One number with a label. The building block of the dashboard and the H2H
 * summary — deliberately plain so a row of them reads as a single unit.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "primary" | "win" | "loss" | "draw";
  className?: string;
}) {
  const valueTone = {
    default: "text-foreground",
    primary: "text-primary",
    win: "text-win",
    loss: "text-loss",
    draw: "text-draw",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-3 text-center",
        className,
      )}
    >
      <p className={cn("tnum text-2xl font-bold leading-none", valueTone)}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Proportional win / draw / loss bar. Renders nothing at zero matches so the
 * caller does not have to guard against a divide by zero.
 */
export function ResultBar({
  wins,
  draws,
  losses,
  className,
}: {
  wins: number;
  draws: number;
  losses: number;
  className?: string;
}) {
  const total = wins + draws + losses;
  if (total === 0) return null;

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div
      className={cn("flex h-2.5 overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`${wins} wins, ${draws} draws, ${losses} losses`}
    >
      {wins > 0 && <div className="bg-win" style={{ width: pct(wins) }} />}
      {draws > 0 && <div className="bg-draw" style={{ width: pct(draws) }} />}
      {losses > 0 && <div className="bg-loss" style={{ width: pct(losses) }} />}
    </div>
  );
}

/** The last few results, newest first — the usual W/D/L form guide. */
export function FormGuide({
  results,
  className,
}: {
  results: { result: "win" | "draw" | "loss" }[];
  className?: string;
}) {
  if (results.length === 0) return null;

  return (
    <div className={cn("flex gap-1", className)}>
      {results.map((entry, index) => (
        <span
          key={index}
          title={entry.result}
          className={cn(
            "grid size-6 place-items-center rounded-md text-[11px] font-bold uppercase",
            entry.result === "win" && "bg-win/15 text-win",
            entry.result === "draw" && "bg-draw/15 text-draw",
            entry.result === "loss" && "bg-loss/15 text-loss",
          )}
        >
          {entry.result[0]}
        </span>
      ))}
    </div>
  );
}
