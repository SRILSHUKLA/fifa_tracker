"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createLeague as createLeagueQuery,
  joinLeague as joinLeagueQuery,
  leaveLeague as leaveLeagueQuery,
  logLeagueFixtureResult as logLeagueFixtureResultQuery,
  startLeague as startLeagueQuery,
} from "@/lib/queries/leagues";
import type { LeagueStatus, LeagueType } from "@/types/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type LeagueActionResult =
  | { ok: true; league: { id: string; name: string } }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  const message = (error as { message?: string })?.message;
  return { ok: false, error: message ?? fallback };
}

export async function createLeagueAction(
  groupId: string,
  name: string,
  type: LeagueType,
  teamId: number,
  knockoutSize: number | null,
): Promise<LeagueActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: "League names are 2-40 characters." };
  }

  try {
    const league = await createLeagueQuery(supabase, {
      groupId,
      name: trimmed,
      type,
      teamId,
      knockoutSize,
    });
    revalidatePath("/", "layout");
    return { ok: true, league: { id: league.id, name: league.name } };
  } catch (error) {
    return failure(error, "Could not create that league.");
  }
}

export async function joinLeagueAction(
  leagueId: string,
  teamId: number,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await joinLeagueQuery(supabase, leagueId, teamId);
  } catch (error) {
    return failure(error, "Could not join that league.");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function leaveLeagueAction(leagueId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await leaveLeagueQuery(supabase, leagueId, userId);
  } catch {
    // RLS silently affects zero rows rather than erroring — same idiom as
    // leaveGroupAction: a league that's already started looks the same as
    // this doing nothing.
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function startLeagueAction(leagueId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  try {
    await startLeagueQuery(supabase, leagueId);
  } catch (error) {
    return failure(error, "Could not start that league.");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export type LogFixtureResult =
  | { ok: true; leagueStatus: LeagueStatus; championId: string | null }
  | { ok: false; error: string };

/**
 * Logs a league fixture's result. Runs on the server for the same reason
 * logMatch does: the freshly written match needs to be visible to the pages
 * we revalidate immediately, not just after the next client refetch.
 */
export async function logLeagueFixtureAction(
  leagueId: string,
  fixtureId: string,
  myScore: number,
  opponentScore: number,
  penaltyWinnerId: string | null,
  playedAt?: string,
  notes?: string | null,
): Promise<LogFixtureResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const scoresValid = [myScore, opponentScore].every(
    (score) => Number.isInteger(score) && score >= 0 && score <= 99,
  );
  if (!scoresValid) return { ok: false, error: "Scores must be 0-99." };

  try {
    const result = await logLeagueFixtureResultQuery(supabase, {
      fixtureId,
      myScore,
      opponentScore,
      penaltyWinnerId,
      playedAt,
      notes,
    });

    revalidatePath("/", "layout");
    revalidatePath(`/leagues/${leagueId}`);

    return {
      ok: true,
      leagueStatus: result.league_status,
      championId: result.champion_id,
    };
  } catch (error) {
    return failure(error, "Could not save that result.");
  }
}
