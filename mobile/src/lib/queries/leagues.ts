import type {
  FixtureStage,
  FixtureStatus,
  League,
  LeagueFixtureResult,
  LeagueParticipant,
  LeagueStandingRow,
  LeagueType,
} from "@/types/database.types";
import type { MatchPlayer } from "./matches";
import { supabase } from "../supabase";

export type MyLeague = {
  joined_at: string;
  team_id: number;
  league: League;
  group: { id: string; name: string };
};

/**
 * Every league the current user has joined, across every group, most
 * recently joined first. `userId` must be filtered on explicitly rather
 * than left to RLS, since league_participants' SELECT policy is
 * spectator-scoped, not "only your own rows".
 */
export async function getMyLeagues(userId: string): Promise<MyLeague[]> {
  const { data, error } = await supabase
    .from("league_participants")
    .select("joined_at, team_id, league:leagues(*, group:groups(id,name))")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .returns<MyLeague[]>();

  if (error) throw error;
  return data ?? [];
}

/** Every league in one group — draft, in progress, or completed. */
export async function getGroupLeagues(groupId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getParticipantCounts(
  leagueIds: string[],
): Promise<Record<string, number>> {
  if (leagueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("league_participants")
    .select("league_id")
    .in("league_id", leagueIds);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.league_id] = (counts[row.league_id] ?? 0) + 1;
  }
  return counts;
}

export async function getLeague(leagueId: string): Promise<League | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type LeagueParticipantWithProfile = {
  user_id: string;
  team_id: number;
  joined_at: string;
  profile: MatchPlayer;
  team: {
    id: number;
    name: string;
    short_name: string | null;
    logo_url: string | null;
  };
};

export async function getLeagueParticipants(
  leagueId: string,
): Promise<LeagueParticipantWithProfile[]> {
  const { data, error } = await supabase
    .from("league_participants")
    .select(
      "user_id, team_id, joined_at, profile:profiles(id,username,display_name,avatar_url), team:teams(id,name,short_name,logo_url)",
    )
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true })
    .returns<LeagueParticipantWithProfile[]>();

  if (error) throw error;
  return data ?? [];
}

export type LeagueFixtureWithPlayers = {
  id: string;
  league_id: string;
  stage: FixtureStage;
  round: number;
  slot: number;
  next_fixture_id: string | null;
  next_fixture_slot: number | null;
  match_id: string | null;
  status: FixtureStatus;
  penalty_winner_id: string | null;
  player_one: MatchPlayer | null;
  player_two: MatchPlayer | null;
  // The logger becomes matches.player_one_id, not fixture.player_one_id, so
  // the two id/score pairs must be matched up by id, not by position.
  match: {
    player_one_id: string;
    player_one_score: number;
    player_two_id: string;
    player_two_score: number;
  } | null;
};

/**
 * PostgREST embed with the same `!constraint_name` hints as MATCH_SELECT:
 * league_fixtures has two foreign keys to profiles.
 */
const FIXTURE_SELECT = `
  id, league_id, stage, round, slot, next_fixture_id, next_fixture_slot, match_id, status, penalty_winner_id,
  player_one:profiles!league_fixtures_player_one_id_fkey(id,username,display_name,avatar_url),
  player_two:profiles!league_fixtures_player_two_id_fkey(id,username,display_name,avatar_url),
  match:matches(player_one_id,player_one_score,player_two_id,player_two_score)
`;

export async function getLeagueFixtures(
  leagueId: string,
): Promise<LeagueFixtureWithPlayers[]> {
  const { data, error } = await supabase
    .from("league_fixtures")
    .select(FIXTURE_SELECT)
    .eq("league_id", leagueId)
    .order("stage", { ascending: true })
    .order("round", { ascending: true })
    .order("slot", { ascending: true })
    .returns<LeagueFixtureWithPlayers[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getLeagueStandings(
  leagueId: string,
): Promise<LeagueStandingRow[]> {
  const { data, error } = await supabase.rpc("get_league_standings", {
    p_league_id: leagueId,
  });
  if (error) throw error;

  const rows = data ?? [];
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) {
      return b.goal_difference - a.goal_difference;
    }
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.username.localeCompare(b.username);
  });
}

export async function createLeague(input: {
  groupId: string;
  name: string;
  type: LeagueType;
  teamId: number;
  knockoutSize?: number | null;
}): Promise<League> {
  const { data, error } = await supabase.rpc("create_league", {
    p_group_id: input.groupId,
    p_name: input.name,
    p_type: input.type,
    p_team_id: input.teamId,
    p_knockout_size: input.knockoutSize ?? null,
  });
  if (error) throw error;
  return data;
}

export async function joinLeague(
  leagueId: string,
  teamId: number,
): Promise<LeagueParticipant> {
  const { data, error } = await supabase.rpc("join_league", {
    p_league_id: leagueId,
    p_team_id: teamId,
  });
  if (error) throw error;
  return data;
}

export async function leaveLeague(leagueId: string, userId: string) {
  const { error } = await supabase
    .from("league_participants")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function startLeague(leagueId: string): Promise<League> {
  const { data, error } = await supabase.rpc("start_league", {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return data;
}

export type LogLeagueFixtureInput = {
  fixtureId: string;
  myScore: number;
  opponentScore: number;
  /** Required only when this is a drawn knockout-stage fixture. */
  penaltyWinnerId?: string | null;
  playedAt?: string;
  notes?: string | null;
};

export async function logLeagueFixtureResult(
  input: LogLeagueFixtureInput,
): Promise<LeagueFixtureResult> {
  const { data, error } = await supabase.rpc("log_league_fixture_result", {
    p_fixture_id: input.fixtureId,
    p_my_score: input.myScore,
    p_opponent_score: input.opponentScore,
    p_penalty_winner_id: input.penaltyWinnerId ?? null,
    p_played_at: input.playedAt ?? new Date().toISOString(),
    p_notes: input.notes?.trim() || null,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error("Could not log that result.");
  return row;
}
