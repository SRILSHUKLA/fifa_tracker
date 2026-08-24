"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_GROUP_COOKIE } from "@/lib/groups/active-group";
import {
  createGroup as createGroupQuery,
  joinGroup as joinGroupQuery,
  leaveGroup,
  regenerateInviteCode as regenerateInviteCodeQuery,
  removeMember as removeMemberQuery,
  renameGroup as renameGroupQuery,
} from "@/lib/queries/groups";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type GroupActionResult =
  | { ok: true; group: { id: string; name: string } }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/**
 * Returns just the failure shape (not the full ActionResult union), so it is
 * directly assignable into any of this file's `{ ok: false; error }`-shaped
 * result types — including GroupActionResult and RegenerateCodeResult, whose
 * `ok: true` branches carry extra fields ActionResult doesn't have.
 */
function failure(error: unknown, fallback: string): { ok: false; error: string } {
  const message = (error as { message?: string })?.message;
  return { ok: false, error: message ?? fallback };
}

export async function createGroup(name: string): Promise<GroupActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: "Group names are 2-40 characters." };
  }

  try {
    const group = await createGroupQuery(supabase, trimmed);
    revalidatePath("/", "layout");
    return { ok: true, group: { id: group.id, name: group.name } };
  } catch (error) {
    return failure(error, "Could not create that group.");
  }
}

/**
 * Joins by invite code. The RPC's own exception messages ("That invite code
 * is not valid.", "This group is full (11 players max).") are written to be
 * shown to the user directly, so they pass straight through.
 */
export async function joinGroup(inviteCode: string): Promise<GroupActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const trimmed = inviteCode.trim();
  if (!trimmed) return { ok: false, error: "Enter an invite code." };

  try {
    const group = await joinGroupQuery(supabase, trimmed);
    revalidatePath("/", "layout");
    return { ok: true, group: { id: group.id, name: group.name } };
  } catch (error) {
    return failure(error, "Could not join that group.");
  }
}

export async function leaveGroupAction(groupId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await leaveGroup(supabase, groupId, userId);
  } catch {
    // RLS silently affects zero rows rather than erroring, so a delete that
    // does nothing is what an owner trying to leave looks like.
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMember(
  groupId: string,
  memberId: string,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await removeMemberQuery(supabase, groupId, memberId);
  } catch (error) {
    return failure(error, "Only the group owner can remove members.");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: "Group names are 2-40 characters." };
  }

  try {
    await renameGroupQuery(supabase, groupId, trimmed);
  } catch (error) {
    return failure(error, "Only the group owner can rename this group.");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export type RegenerateCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function regenerateInviteCode(
  groupId: string,
): Promise<RegenerateCodeResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    const code = await regenerateInviteCodeQuery(supabase, groupId);
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, code };
  } catch (error) {
    return failure(error, "Only the group owner can do that.");
  }
}

/** Remembers which group the dashboard/leaderboard/history tabs should show. */
export async function setActiveGroup(groupId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
