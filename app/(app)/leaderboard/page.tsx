import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PlayerAvatar } from "@/components/player-avatar";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/format";
import { getActiveGroup } from "@/lib/groups/active-group";
import { getGroupLeaderboard } from "@/lib/queries/groups";

export const metadata: Metadata = { title: "Leaderboard · Bragging Rights" };

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { active } = await getActiveGroup(supabase, user.id);

  if (!active) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        </div>
        <EmptyState
          icon={UsersRound}
          title="No group yet"
          description="The table is scoped to a group. Create or join one to see who's winning."
          action={{ href: "/groups", label: "Find a group" }}
        />
      </div>
    );
  }

  const rows = await getGroupLeaderboard(supabase, active.group.id);

  // Every member appears in the RPC's result. Players who have not played
  // yet would all sit on zero points, so they are listed separately below
  // rather than padding out the table.
  const ranked = rows.filter((row) => row.played > 0);
  const unranked = rows.filter((row) => row.played === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          {active.group.name} · 3 points a win, 1 a draw. Ties split on goal
          difference.
        </p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nothing to rank yet"
          description="The table fills up as soon as the first match is logged."
          action={{
            href: `/match/new?group=${active.group.id}`,
            label: "Log a match",
          }}
        />
      ) : (
        <LeaderboardTable rows={ranked} viewerId={user.id} groupId={active.group.id} />
      )}

      {unranked.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Yet to play
          </h2>
          <div className="flex flex-wrap gap-2">
            {unranked.map((row) => (
              <Link
                key={row.id}
                href={
                  row.id === user.id
                    ? "/history"
                    : `/groups/${active.group.id}/members/${row.username}`
                }
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm"
              >
                <PlayerAvatar
                  person={row}
                  size="sm"
                  highlight={row.id === user.id}
                />
                <span className="truncate">{displayName(row)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
