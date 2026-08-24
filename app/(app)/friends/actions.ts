"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  removeFriend,
  respondToRequest,
  searchUsers,
  sendFriendRequest,
} from "@/lib/queries/friends";
import type { UserSearchResult } from "@/types/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function failure(error: unknown, fallback: string): ActionResult {
  const message = (error as { message?: string })?.message;
  return { ok: false, error: message ?? fallback };
}

/**
 * Runs the user search on the server so the RPC call is not another
 * round trip from the phone's own network.
 */
export async function searchPeople(query: string): Promise<UserSearchResult[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];

  try {
    return await searchUsers(supabase, query);
  } catch {
    return [];
  }
}

export async function addFriend(addresseeId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };
  if (userId === addresseeId) {
    return { ok: false, error: "You cannot add yourself." };
  }

  try {
    await sendFriendRequest(supabase, userId, addresseeId);
  } catch (error) {
    return failure(error, "Could not send that request.");
  }

  revalidatePath("/friends");
  return { ok: true };
}

export async function answerRequest(
  friendshipId: string,
  accept: boolean,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await respondToRequest(supabase, friendshipId, accept);
  } catch (error) {
    return failure(error, "Could not answer that request.");
  }

  // The nav badge lives in the app layout, so revalidate the whole tree.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Unfriends in either direction. Past matches are deliberately kept: deleting
 * them would silently rewrite the leaderboard for everyone else.
 */
export async function unfriend(friendId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await removeFriend(supabase, userId, friendId);
  } catch (error) {
    return failure(error, "Could not remove that friend.");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
