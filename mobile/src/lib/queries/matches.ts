import type { FixtureStage, MatchResult } from "@/types/database.types";
import { supabase } from "../supabase";

/** A person as rendered on a match card. */
export type MatchPlayer = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type MatchTeam = {
  id: number;
  name: string;
  short_name: string | null;
  logo_url: string | null;
} | null;

export type MatchWithPlayers = {
  id: string;
  group_id: string;
  played_at: string;
  player_one_score: number;
  player_two_score: number;
  winner_id: string | null;
  notes: string | null;
  created_by: string;
  player_one: MatchPlayer;
  player_two: MatchPlayer;
  team_one: MatchTeam;
  team_two: MatchTeam;
  /**
   * Set when this match is linked to a league fixture — null for an
   * ordinary match. Fetched via a follow-up query rather than an embed,
   * since league_fixtures.match_id is only unique through a partial index.
   */
  leagueFixtureStage: FixtureStage | null;
};

/**
 * PostgREST embed. The `!constraint_name` hints are required because
 * `matches` has two foreign keys to `profiles` and two to `teams` — without
 * them PostgREST cannot tell which relationship to follow and errors out.
 */
const MATCH_SELECT = `
  id,
  group_id,
  played_at,
  player_one_score,
  player_two_score,
  winner_id,
  notes,
  created_by,
  player_one:profiles!matches_player_one_id_fkey(id,username,display_name,avatar_url),
  player_two:profiles!matches_player_two_id_fkey(id,username,display_name,avatar_url),
  team_one:teams!matches_player_one_team_id_fkey(id,name,short_name,logo_url),
  team_two:teams!matches_player_two_team_id_fkey(id,name,short_name,logo_url)
`;

/**
 * Matches involving `playerId`, newest first. Pass `opponentId` to narrow to
 * a single head-to-head, and `groupId` to scope to one group — every caller
 * should pass `groupId`, since a pair of people sharing more than one group
 * would otherwise blend two unrelated histories into one feed.
 */
export async function getMatches(
  opts: {
    playerId?: string;
    opponentId?: string;
    groupId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { playerId, opponentId, groupId, limit = 20, offset = 0 } = opts;

  let query = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("played_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (groupId) {
    query = query.eq("group_id", groupId);
  }

  if (playerId && opponentId) {
    // Either seating arrangement counts as the same fixture.
    query = query.or(
      `and(player_one_id.eq.${playerId},player_two_id.eq.${opponentId}),` +
        `and(player_one_id.eq.${opponentId},player_two_id.eq.${playerId})`,
    );
  } else if (playerId) {
    query = query.or(
      `player_one_id.eq.${playerId},player_two_id.eq.${playerId}`,
    );
  }

  const { data, error } = await query.returns<
    Omit<MatchWithPlayers, "leagueFixtureStage">[]
  >();
  if (error) throw error;
  const matches = data ?? [];

  const stageByMatch = new Map<string, FixtureStage>();
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length > 0) {
    const { data: fixtureRows, error: fixtureError } = await supabase
      .from("league_fixtures")
      .select("match_id, stage")
      .in("match_id", matchIds);
    if (fixtureError) throw fixtureError;
    for (const row of fixtureRows ?? []) {
      if (row.match_id) stageByMatch.set(row.match_id, row.stage);
    }
  }

  return matches.map((m) => ({
    ...m,
    leagueFixtureStage: stageByMatch.get(m.id) ?? null,
  }));
}

export async function getMatch(matchId: string): Promise<MatchWithPlayers | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .returns<Omit<MatchWithPlayers, "leagueFixtureStage">[]>();
  if (error) throw error;

  const row = (data ?? [])[0];
  if (!row) return null;

  const { data: fixtureRows, error: fixtureError } = await supabase
    .from("league_fixtures")
    .select("stage")
    .eq("match_id", matchId)
    .maybeSingle();
  if (fixtureError) throw fixtureError;

  return { ...row, leagueFixtureStage: fixtureRows?.stage ?? null };
}

/**
 * Re-frames a match from one player's point of view, so the UI never has to
 * care which side of the row they happen to sit on.
 */
export function fromPerspective(match: MatchWithPlayers, viewerId: string) {
  const isPlayerOne = match.player_one.id === viewerId;

  const me = isPlayerOne ? match.player_one : match.player_two;
  const them = isPlayerOne ? match.player_two : match.player_one;
  const myScore = isPlayerOne ? match.player_one_score : match.player_two_score;
  const theirScore = isPlayerOne
    ? match.player_two_score
    : match.player_one_score;
  const myTeam = isPlayerOne ? match.team_one : match.team_two;
  const theirTeam = isPlayerOne ? match.team_two : match.team_one;

  const result: MatchResult =
    myScore > theirScore ? "win" : myScore < theirScore ? "loss" : "draw";

  return { me, them, myScore, theirScore, myTeam, theirTeam, result };
}

export type NewMatchInput = {
  groupId: string;
  opponentId: string;
  myScore: number;
  opponentScore: number;
  myTeamId: number | null;
  opponentTeamId: number | null;
  playedAt?: string;
  notes?: string | null;
};

/**
 * Logs a match. The current user is always stored as player_one.
 * `winner_id` is deliberately not sent: it is a generated column, so the
 * database decides the result from the score.
 */
export async function createMatch(userId: string, input: NewMatchInput) {
  const { error } = await supabase.from("matches").insert({
    group_id: input.groupId,
    player_one_id: userId,
    player_two_id: input.opponentId,
    player_one_score: input.myScore,
    player_two_score: input.opponentScore,
    player_one_team_id: input.myTeamId,
    player_two_team_id: input.opponentTeamId,
    created_by: userId,
    played_at: input.playedAt ?? new Date().toISOString(),
    notes: input.notes?.trim() || null,
  });

  if (error) throw error;
}

export type EditMatchInput = {
  matchId: string;
  /** Absolute orientation (player_one_*), not "my score" — either
   * participant may edit, so callers map from a "me/them" UI using
   * `isPlayerOne = match.player_one.id === viewerId`. */
  playerOneScore: number;
  playerTwoScore: number;
  playerOneTeamId: number | null;
  playerTwoTeamId: number | null;
  playedAt: string;
  notes?: string | null;
  /** Required only when correcting a drawn knockout-stage league fixture. */
  penaltyWinnerId?: string | null;
};

export async function editMatch(input: EditMatchInput) {
  const { error } = await supabase.rpc("edit_match", {
    p_match_id: input.matchId,
    p_player_one_score: input.playerOneScore,
    p_player_two_score: input.playerTwoScore,
    p_player_one_team_id: input.playerOneTeamId,
    p_player_two_team_id: input.playerTwoTeamId,
    p_played_at: input.playedAt,
    p_notes: input.notes?.trim() || null,
    p_penalty_winner_id: input.penaltyWinnerId ?? null,
  });
  if (error) throw error;
}
