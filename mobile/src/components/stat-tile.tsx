import { Text, View } from "react-native";

import { Num } from "./screen";

const TONES = {
  default: "text-foreground",
  primary: "text-accent",
  win: "text-win",
  loss: "text-loss",
  draw: "text-draw",
} as const;

/**
 * One number with a label. The building block of the dashboard and the H2H
 * summary — deliberately plain so a row of them reads as a single unit.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  className = "",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <View
      className={`rounded-xl border border-border bg-surface px-3 py-3 ${className}`}
    >
      <Num className={`text-2xl font-bold leading-7 ${TONES[tone]}`}>
        {value}
      </Num>
      <Text className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </Text>
      {sub && <Text className="mt-0.5 text-[11px] text-muted">{sub}</Text>}
    </View>
  );
}

/**
 * Proportional win / draw / loss bar. Renders nothing at zero matches so
 * callers never divide by zero.
 */
export function ResultBar({
  wins,
  draws,
  losses,
}: {
  wins: number;
  draws: number;
  losses: number;
}) {
  const total = wins + draws + losses;
  if (total === 0) return null;

  const pct = (n: number): `${number}%` => `${(n / total) * 100}%` as const;

  return (
    <View
      accessibilityLabel={`${wins} wins, ${draws} draws, ${losses} losses`}
      className="h-2.5 flex-row overflow-hidden rounded-full bg-default"
    >
      {wins > 0 && (
        <View className="bg-win" style={{ width: pct(wins) }} />
      )}
      {draws > 0 && (
        <View className="bg-draw" style={{ width: pct(draws) }} />
      )}
      {losses > 0 && (
        <View className="bg-loss" style={{ width: pct(losses) }} />
      )}
    </View>
  );
}

/** The last few results, newest first — the usual W/D/L form guide. */
export function FormGuide({
  results,
}: {
  results: { result: "win" | "draw" | "loss" }[];
}) {
  if (results.length === 0) return null;

  const tone = {
    win: "bg-win/15 text-win",
    draw: "bg-draw/15 text-draw",
    loss: "bg-loss/15 text-loss",
  } as const;

  return (
    <View className="flex-row gap-1">
      {results.map((entry, index) => (
        <View
          key={index}
          accessibilityLabel={entry.result}
          className={`h-6 w-6 items-center justify-center rounded-md ${tone[entry.result]}`}
        >
          <Text className="text-[11px] font-bold uppercase">
            {entry.result[0]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The dashboard's headline record card — points, result bar and form guide.
 * Shared by Home, History and the group detail page.
 */
export function RecordCard({
  heading,
  played,
  points,
  wins,
  draws,
  losses,
  form,
}: {
  heading: string;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  form: { result: "win" | "draw" | "loss" }[];
}) {
  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold text-foreground">{heading}</Text>
        <Text className="text-sm text-muted">
          {played} {played === 1 ? "match" : "matches"}
        </Text>
      </View>

      <View className="mt-3 flex-row items-end gap-4">
        <View>
          <Num className="text-[40px] font-bold leading-10 text-accent">
            {points}
          </Num>
          <Text className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            Points
          </Text>
        </View>

        <View className="flex-1 pb-1">
          <ResultBar wins={wins} draws={draws} losses={losses} />
          <View className="mt-2 flex-row justify-between">
            <Text className="text-xs text-win">{wins}W</Text>
            <Text className="text-xs text-draw">{draws}D</Text>
            <Text className="text-xs text-loss">{losses}L</Text>
          </View>
        </View>
      </View>

      {form.length > 0 && (
        <View className="mt-4 flex-row items-center gap-3 border-t border-border pt-3">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Form
          </Text>
          <FormGuide results={form} />
        </View>
      )}
    </View>
  );
}
