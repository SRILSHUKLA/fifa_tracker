import { Text, View } from "react-native";

import type { LeagueStatus, LeagueType } from "@/types/database.types";

const STATUS: Record<
  LeagueStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Open to join",
    className: "border-border bg-surface text-muted",
  },
  in_progress: {
    label: "In progress",
    className: "border-accent/40 bg-accent/15 text-accent",
  },
  completed: {
    label: "Completed",
    className: "border-border bg-default text-default-foreground",
  },
};

export function LeagueStatusBadge({ status }: { status: LeagueStatus }) {
  const { label, className } = STATUS[status];

  return (
    <View
      className={`shrink-0 rounded-full border px-2 py-0.5 ${className}`}
    >
      <Text numberOfLines={1} className="text-[11px] font-medium">
        {label}
      </Text>
    </View>
  );
}

const LABELS: Record<LeagueType, string> = {
  single_round_robin: "Single round robin",
  double_round_robin: "Double round robin",
  round_robin_knockout: "Round robin + knockout",
};

const DESCRIPTIONS: Record<LeagueType, string> = {
  single_round_robin: "Everyone plays everyone once.",
  double_round_robin: "Everyone plays everyone twice.",
  round_robin_knockout:
    "A round robin group stage, then a single-elimination knockout among the top finishers.",
};

export function leagueTypeLabel(type: LeagueType) {
  return LABELS[type];
}

export function leagueTypeDescription(type: LeagueType) {
  return DESCRIPTIONS[type];
}
