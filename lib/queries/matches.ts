import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, MatchResult } from "@/types/database.types";

export type Client = SupabaseClient<Database>;

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
};

/**
 * PostgREST embed. The `!constraint_name` hints are required because `matches`
 * has two foreign keys to `profiles` and two to `teams` — without them
 * PostgREST cannot tell which relationship to follow and returns an error.
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
 * Matches involving `playerId`, newest first. Omit `playerId` for every
 * match the caller can see (RLS already limits that to shared-group
 * matches). Pass `opponentId` to narrow to a single head-to-head, and
 * `groupId` to scope to one group — every caller that isn't reading a
 * single already-known match should pass `groupId`, since a pair of people
 * sharing more than one group would otherwise blend two unrelated histories
 * into one feed.
 */
export async function getMatches(
  supabase: Client,
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

  const { data, error } = await query.returns<MatchWithPlayers[]>();
  if (error) throw error;
  return data ?? [];
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
 * Logs a match. The current user is always stored as player_one — see the
 * convention note in 0001_init.sql. `winner_id` is deliberately not sent: it
 * is a generated column, so the database decides the result from the score.
 * `groupId` is required and, once inserted, effectively permanent — there is
 * no update path for it, since re-attributing a match to a different group
 * would silently rewrite two other people's history.
 */
export async function createMatch(
  supabase: Client,
  userId: string,
  input: NewMatchInput,
) {
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

export async function deleteMatch(supabase: Client, matchId: string) {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw error;
}
