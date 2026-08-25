import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeagueForm } from "@/components/leagues/league-form";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/queries/groups";
import { getTeams } from "@/lib/queries/teams";

export const metadata: Metadata = { title: "New league · Bragging Rights" };

export default async function NewLeaguePage({
  searchParams,
}: PageProps<"/leagues/new">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // `?group=<id>` lets the group page deep-link straight into "New league"
  // pre-scoped to that group, same pattern as /match/new?group=.
  const { group: groupParam } = await searchParams;

  const [myGroups, teams] = await Promise.all([
    getMyGroups(supabase, user.id),
    getTeams(supabase),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New league</h1>
        <p className="text-sm text-muted-foreground">
          Pick a format and your team — everyone else in the group can join
          until you start it.
        </p>
      </div>

      {myGroups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Leagues live inside a group. Create or join one first."
          action={{ href: "/groups", label: "Find a group" }}
        />
      ) : (
        <LeagueForm
          groups={myGroups.map(({ group }) => ({ id: group.id, name: group.name }))}
          teams={teams}
          defaultGroupId={typeof groupParam === "string" ? groupParam : undefined}
        />
      )}
    </div>
  );
}
