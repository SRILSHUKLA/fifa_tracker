"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createMatch,
  editMatch,
  type EditMatchInput,
  type NewMatchInput,
} from "@/lib/queries/matches";

export type LogMatchResult = { ok: true } | { ok: false; error: string };

/**
 * Logs a match on behalf of the signed-in user.
 *
 * Runs on the server so the freshly written match is visible to the pages we
 * revalidate; doing the insert from the browser would leave the server-rendered
 * dashboard and leaderboard stale until the next full reload.
 */
export async function logMatch(input: NewMatchInput): Promise<LogMatchResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You are not signed in." };

  if (input.opponentId === user.id) {
    return { ok: false, error: "Pick someone other than yourself." };
  }

  const scoresValid = [input.myScore, input.opponentScore].every(
    (score) => Number.isInteger(score) && score >= 0 && score <= 99,
  );

  if (!scoresValid) return { ok: false, error: "Scores must be 0-99." };

  try {
    await createMatch(supabase, user.id, input);
  } catch (error) {
    const code = (error as { code?: string })?.code;

    // 42501 is an RLS denial. The only way to trip it here is logging
    // against someone who does not (or no longer does) share this group.
    if (code === "42501") {
      return {
        ok: false,
        error: "You can only log matches against people in the same group.",
      };
    }

    return {
      ok: false,
      error:
        (error as { message?: string })?.message ??
        "Could not save that match.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export type EditMatchResult = { ok: true } | { ok: false; error: string };

/**
 * Corrects an already-logged match. Runs on the server for the same reason
 * logMatch does — the correction needs to show up on the pages we
 * revalidate immediately, not just after the next client refetch.
 */
export async function editMatchAction(input: EditMatchInput): Promise<EditMatchResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You are not signed in." };

  const scoresValid = [input.playerOneScore, input.playerTwoScore].every(
    (score) => Number.isInteger(score) && score >= 0 && score <= 99,
  );

  if (!scoresValid) return { ok: false, error: "Scores must be 0-99." };

  try {
    await editMatch(supabase, input);
  } catch (error) {
    return {
      ok: false,
      error: (error as { message?: string })?.message ?? "Could not save that correction.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
