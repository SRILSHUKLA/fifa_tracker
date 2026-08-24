import { cookies } from "next/headers";

import { getMyGroups, type MyGroup } from "@/lib/queries/groups";
import type { Client } from "@/lib/queries/matches";

/**
 * Which group a page like the dashboard, leaderboard or history should show
 * when it can only show one at a time. Written by the group switcher's
 * `setActiveGroup` action.
 */
export const ACTIVE_GROUP_COOKIE = "active_group_id";

/**
 * Picks the "current" group out of everything the user belongs to.
 *
 *   0 groups -> null, callers render an onboarding empty state.
 *   1 group  -> that one, always; there is nothing to switch between.
 *   2+       -> whichever the cookie points at, if it is still one of the
 *               user's groups, otherwise the most recently joined.
 *
 * Pure function so it is trivial to unit test independently of cookies().
 */
export function resolveActiveGroup(
  groups: MyGroup[],
  cookieGroupId: string | null,
): MyGroup | null {
  if (groups.length === 0) return null;
  if (groups.length === 1) return groups[0];

  return groups.find((g) => g.group.id === cookieGroupId) ?? groups[0];
}

/**
 * Fetches every group the user belongs to and resolves which one is active,
 * in one call. `groups` is ordered most-recently-joined first (see
 * getMyGroups), which is also the fallback order resolveActiveGroup falls
 * back to when the cookie is missing or stale.
 */
export async function getActiveGroup(supabase: Client, userId: string) {
  const [groups, cookieStore] = await Promise.all([
    getMyGroups(supabase, userId),
    cookies(),
  ]);

  const active = resolveActiveGroup(
    groups,
    cookieStore.get(ACTIVE_GROUP_COOKIE)?.value ?? null,
  );

  return { groups, active };
}
