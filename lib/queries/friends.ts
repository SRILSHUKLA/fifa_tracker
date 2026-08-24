import type { Client } from "./matches";
import type { FriendSummary, UserSearchResult } from "@/types/database.types";

export type PendingRequest = {
  id: string;
  created_at: string;
  requester: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type SentRequest = {
  id: string;
  created_at: string;
  addressee: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

/** Accepted friends, each with the current user's record against them. */
export async function getFriends(supabase: Client): Promise<FriendSummary[]> {
  const { data, error } = await supabase.rpc("get_friends");
  if (error) throw error;
  return data ?? [];
}

/** Requests waiting on the current user to accept or decline. */
export async function getIncomingRequests(
  supabase: Client,
  userId: string,
): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `id, created_at,
       requester:profiles!friendships_requester_id_fkey(id,username,display_name,avatar_url)`,
    )
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<PendingRequest[]>();

  if (error) throw error;
  return data ?? [];
}

/** Requests the current user has sent that are still unanswered. */
export async function getOutgoingRequests(
  supabase: Client,
  userId: string,
): Promise<SentRequest[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `id, created_at,
       addressee:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_url)`,
    )
    .eq("requester_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<SentRequest[]>();

  if (error) throw error;
  return data ?? [];
}

/**
 * Username prefix match, or an exact email match. Runs as a security definer
 * RPC so it can check emails against auth.users without exposing them.
 */
export async function searchUsers(
  supabase: Client,
  q: string,
): Promise<UserSearchResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("search_users", { q: trimmed });
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(
  supabase: Client,
  userId: string,
  addresseeId: string,
) {
  const { error } = await supabase.from("friendships").insert({
    requester_id: userId,
    addressee_id: addresseeId,
    status: "pending",
  });

  // The unique-pair index means a race (both people adding each other at once)
  // surfaces as 23505. That is not a failure worth showing the user.
  if (error && error.code !== "23505") throw error;
}

export async function respondToRequest(
  supabase: Client,
  friendshipId: string,
  accept: boolean,
) {
  if (!accept) {
    // Declining removes the row entirely, so the pair can try again later.
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;
}

/** Removes the friendship in either direction. Past matches are kept. */
export async function removeFriend(
  supabase: Client,
  userId: string,
  friendId: string,
) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),` +
        `and(requester_id.eq.${friendId},addressee_id.eq.${userId})`,
    );
  if (error) throw error;
}
