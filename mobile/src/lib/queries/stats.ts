import type { H2HStats, H2HTeamStat, GroupTeamStat, Profile } from "@/types/database.types";
import { supabase } from "../supabase";

export async function getH2HStats(
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

export async function getH2HTeamStats(
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

export async function getGroupTeamStats(
  groupId: string,
): Promise<GroupTeamStat[]> {
  const { data, error } = await supabase.rpc("get_group_team_stats", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getProfileByUsername(
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

export async function getProfile(id: string): Promise<Profile | null> {
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
 * newest first — the little form guide on the dashboard.
 */
export async function getRecentForm(playerId: string, groupId: string, limit = 5) {
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
