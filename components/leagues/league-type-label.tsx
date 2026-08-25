import type { LeagueType } from "@/types/database.types";

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
