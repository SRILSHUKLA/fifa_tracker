import type { Client } from "./matches";
import type { H2HStats, LeaderboardRow, Profile } from "@/types/database.types";

/**
 * Global standings. The view computes points as 3W + D; ordering happens here
 * because PostgREST can only sort by columns, and the tiebreak chain is
 * points, then goal difference, then goals scored — the usual football table.
 */
export async function getLeaderboard(
  supabase: Client,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("points", { ascending: false })
    .order("goal_difference", { ascending: false })
    .order("goals_for", { ascending: false })
    .order("username", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** One player's row from the leaderboard view, used for the dashboard tiles. */
export async function getPlayerStats(
  supabase: Client,
  playerId: string,
): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Head-to-head totals between the current user and one opponent.
 * The RPC always returns exactly one row, zero-filled when they have never
 * played, so the H2H page never has to special-case an empty result.
 */
export async function getH2HStats(
  supabase: Client,
  opponentId: string,
): Promise<H2HStats> {
  const { data, error } = await supabase.rpc("get_h2h_stats", {
    p_opponent: opponentId,
  });

  if (error) throw error;

  return (
    data?.[0] ?? {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      avg_goals_for: 0,
      avg_goals_against: 0,
      biggest_win_margin: 0,
      last_played: null,
    }
  );
}

export async function getProfileByUsername(
  supabase: Client,
  username: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", username)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getProfile(
  supabase: Client,
  id: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Win / draw / loss over the player's most recent matches, newest first.
 * Rendered as the little form guide on the dashboard.
 */
export async function getRecentForm(
  supabase: Client,
  playerId: string,
  limit = 5,
) {
  const { data, error } = await supabase
    .from("player_match_results")
    .select("result, played_at")
    .eq("player_id", playerId)
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
