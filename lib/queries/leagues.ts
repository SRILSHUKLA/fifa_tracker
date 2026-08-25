import type { Client, MatchPlayer } from "./matches";
import type {
  FixtureStage,
  FixtureStatus,
  League,
  LeagueFixtureResult,
  LeagueParticipant,
  LeagueStandingRow,
  LeagueType,
} from "@/types/database.types";

export type MyLeague = {
  joined_at: string;
  team_id: number;
  league: League;
  group: { id: string; name: string };
};

/**
 * Every league the current user has joined, across every group, most
 * recently joined first. Mirrors getMyGroups: `userId` must be filtered on
 * explicitly rather than left to RLS, since league_participants' SELECT
 * policy is spectator-scoped ("any group member"), not "only your own rows".
 */
export async function getMyLeagues(
  supabase: Client,
  userId: string,
): Promise<MyLeague[]> {
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
export async function getGroupLeagues(
  supabase: Client,
  groupId: string,
): Promise<League[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * How many participants each of the given leagues has, in one round trip —
 * powers the participant count shown on league list rows without an N+1.
 */
export async function getParticipantCounts(
  supabase: Client,
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

export async function getLeague(
  supabase: Client,
  leagueId: string,
): Promise<League | null> {
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
  team: { id: number; name: string; short_name: string | null; logo_url: string | null };
};

/** Roster for one league, each participant with their locked-in team. */
export async function getLeagueParticipants(
  supabase: Client,
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
  // the two id/score pairs below must be matched up by id, not by position —
  // see scoreFromPerspective in components/leagues/league-fixture-card.tsx.
  match: {
    player_one_id: string;
    player_one_score: number;
    player_two_id: string;
    player_two_score: number;
  } | null;
};

/**
 * PostgREST embed. The `!constraint_name` hints are required for the same
 * reason as MATCH_SELECT in matches.ts: league_fixtures has two foreign keys
 * to profiles (player_one_id, player_two_id), so PostgREST needs to be told
 * which one each embed follows.
 */
const FIXTURE_SELECT = `
  id, league_id, stage, round, slot, next_fixture_id, next_fixture_slot, match_id, status, penalty_winner_id,
  player_one:profiles!league_fixtures_player_one_id_fkey(id,username,display_name,avatar_url),
  player_two:profiles!league_fixtures_player_two_id_fkey(id,username,display_name,avatar_url),
  match:matches(player_one_id,player_one_score,player_two_id,player_two_score)
`;

/** Every fixture in a league, round-robin fixtures before knockout, in round/slot order. */
export async function getLeagueFixtures(
  supabase: Client,
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

/**
 * Standings for one league (round-robin-stage results only — see
 * get_league_standings in 0005_leagues.sql). Ordering happens here for the
 * same reason as getGroupLeaderboard: PostgREST can only sort by columns,
 * and the tiebreak chain is points, then goal difference, then goals scored.
 */
export async function getLeagueStandings(
  supabase: Client,
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

/**
 * Creates a league and seats the caller as its first participant (with
 * their chosen team), atomically. `knockoutSize` is required for
 * round_robin_knockout and must be omitted otherwise — create_league()
 * enforces this server-side.
 */
export async function createLeague(
  supabase: Client,
  input: {
    groupId: string;
    name: string;
    type: LeagueType;
    teamId: number;
    knockoutSize?: number | null;
  },
): Promise<League> {
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

/**
 * Joins a league by picking a team. Re-joining pre-start (or a double-tap)
 * upserts the team choice rather than erroring — same idiom as join_group.
 */
export async function joinLeague(
  supabase: Client,
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

/** Leaves a still-draft league. Not possible once the league has started. */
export async function leaveLeague(
  supabase: Client,
  leagueId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("league_participants")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Creator-only: locks the roster and generates every round-robin fixture instantly. */
export async function startLeague(
  supabase: Client,
  leagueId: string,
): Promise<League> {
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

/**
 * Logs a fixture's result. This is a single transactional RPC — see
 * log_league_fixture_result in 0005_leagues.sql — so the returned row
 * always reflects the league's state immediately after this result (whether
 * the round robin just finished, the bracket just advanced, or a champion
 * was just crowned).
 */
export async function logLeagueFixtureResult(
  supabase: Client,
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
