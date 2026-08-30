import type {
  Group,
  GroupLeaderboardRow,
  GroupMemberSummary,
  GroupRole,
} from "@/types/database.types";
import { supabase } from "../supabase";

export type MyGroup = {
  role: GroupRole;
  joined_at: string;
  group: Group;
};

/**
 * Every group the current user belongs to, most recently joined first.
 * `userId` must be filtered on explicitly rather than left to RLS — the
 * group_members SELECT policy scopes to "any row in a group you belong to",
 * so an unfiltered select duplicates every group you share with anyone.
 */
export async function getMyGroups(userId: string): Promise<MyGroup[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, joined_at, group:groups(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .returns<MyGroup[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Roster for one group, each member's record against the caller. */
export async function getGroupMembers(
  groupId: string,
): Promise<GroupMemberSummary[]> {
  const { data, error } = await supabase.rpc("get_group_members", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Standings for one group. The RPC computes points as 3W + D; ordering
 * happens here because the tiebreak chain is points → goal difference →
 * goals scored → name.
 */
export async function getGroupLeaderboard(
  groupId: string,
): Promise<GroupLeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_group_leaderboard", {
    p_group_id: groupId,
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

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase.rpc("create_group", {
    p_name: name,
  });
  if (error) throw error;
  return data;
}

export async function joinGroup(inviteCode: string): Promise<Group> {
  const { data, error } = await supabase.rpc("join_group", {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  return data;
}

/** Leaves a group. Past matches are kept. The owner cannot leave (RLS). */
export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Owner-only: removes another member. Past matches are kept. */
export async function removeMember(groupId: string, memberId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId);
  if (error) throw error;
}

/** Owner-only: renames the group. */
export async function renameGroup(groupId: string, name: string) {
  const { error } = await supabase
    .from("groups")
    .update({ name })
    .eq("id", groupId);
  if (error) throw error;
}

export async function regenerateInviteCode(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc("regenerate_invite_code", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data;
}
