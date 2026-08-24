import type { Client } from "./matches";
import type {
  GroupTeamStat,
  H2HStats,
  H2HTeamStat,
  Profile,
} from "@/types/database.types";

/**
 * Head-to-head totals between the current user and one opponent, scoped to a
 * single group. The RPC always returns exactly one row, zero-filled when
 * they have never played each other in this group, so the H2H page never
 * has to special-case an empty result.
 */
export async function getH2HStats(
  supabase: Client,
  groupId: string,
  opponentId: string,
): Promise<H2HStats> {
  const { data, error } = await supabase.rpc("get_h2h_stats", {
    p_group_id: groupId,
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

/**
 * Which team(s) the current user picks against one opponent within a group,
 * and the record with each — the "team-based head-to-head" breakdown.
 */
export async function getH2HTeamStats(
  supabase: Client,
  groupId: string,
  opponentId: string,
): Promise<H2HTeamStat[]> {
  const { data, error } = await supabase.rpc("get_h2h_team_stats", {
    p_group_id: groupId,
    p_opponent: opponentId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * The current user's team record across the whole group, not tied to any one
 * opponent — "which team do I actually play well" within this group.
 */
export async function getGroupTeamStats(
  supabase: Client,
  groupId: string,
): Promise<GroupTeamStat[]> {
  const { data, error } = await supabase.rpc("get_group_team_stats", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data ?? [];
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
 * Win / draw / loss over the player's most recent matches within one group,
 * newest first. Rendered as the little form guide on the dashboard and the
 * group/member pages.
 */
export async function getRecentForm(
  supabase: Client,
  playerId: string,
  groupId: string,
  limit = 5,
) {
  const { data, error } = await supabase
    .from("player_match_results")
    .select("result, played_at")
    .eq("player_id", playerId)
    .eq("group_id", groupId)
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
