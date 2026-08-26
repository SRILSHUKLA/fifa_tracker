import type { Team } from "@/types/database.types";
import { supabase } from "../supabase";

/** Leagues in the order the picker should group them. */
export const LEAGUE_ORDER = [
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
  "Rest of Europe",
  "International",
] as const;

/**
 * Every team, fetched once and cached by React Query. The table is ~165
 * rows and a few KB, so pulling the lot beats a debounced round trip per
 * keystroke on a phone.
 */
export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Groups teams by league, in LEAGUE_ORDER, for the grouped picker. */
export function groupByLeague(teams: Team[]) {
  const groups = new Map<string, Team[]>();

  for (const league of LEAGUE_ORDER) groups.set(league, []);
  for (const team of teams) {
    const bucket = groups.get(team.league);
    if (bucket) bucket.push(team);
    else groups.set(team.league, [team]);
  }

  return [...groups.entries()].filter(([, teams]) => teams.length > 0);
}

/** What to render when space is tight — the code if we have one, else the name. */
export function teamLabel(
  team: { name: string; short_name: string | null } | null,
) {
  if (!team) return null;
  return team.short_name ?? team.name;
}
