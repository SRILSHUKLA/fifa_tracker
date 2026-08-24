import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";

import { AddMatchForm, type MatchFormGroup } from "@/components/match/add-match-form";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getGroupMembers, getMyGroups } from "@/lib/queries/groups";
import { getProfile } from "@/lib/queries/stats";
import { getTeams } from "@/lib/queries/teams";

export const metadata: Metadata = { title: "Log a match · Bragging Rights" };

export default async function NewMatchPage({
  searchParams,
}: PageProps<"/match/new">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // `?group=<id>` and `?opponent=<id>` let a group or H2H page deep-link
  // straight into a rematch.
  const { group: groupParam, opponent } = await searchParams;

  const [me, myGroups, teams] = await Promise.all([
    getProfile(supabase, user.id),
    getMyGroups(supabase, user.id),
    getTeams(supabase),
  ]);

  if (!me) redirect("/auth/signout");

  // Each group's roster is small (11 players max), so loading every group's
  // members up front avoids a round trip when the user switches groups
  // inside the form.
  const groups: MatchFormGroup[] = await Promise.all(
    myGroups.map(async ({ group }) => ({
      id: group.id,
      name: group.name,
      members: await getGroupMembers(supabase, group.id),
    })),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log a match</h1>
        <p className="text-sm text-muted-foreground">
          The winner is worked out from the score.
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Matches are logged within a group. Create or join one first."
          action={{ href: "/groups", label: "Find a group" }}
        />
      ) : (
        <AddMatchForm
          me={me}
          groups={groups}
          teams={teams}
          defaultGroupId={
            typeof groupParam === "string" ? groupParam : undefined
          }
          defaultOpponentId={
            typeof opponent === "string" ? opponent : undefined
          }
        />
      )}
    </div>
  );
}
