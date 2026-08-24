import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";

import { AddMatchForm } from "@/components/match/add-match-form";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getFriends } from "@/lib/queries/friends";
import { getProfile } from "@/lib/queries/stats";
import { getTeams } from "@/lib/queries/teams";

export const metadata: Metadata = { title: "Log a match · FIFA Tracker" };

export default async function NewMatchPage({
  searchParams,
}: PageProps<"/match/new">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // `?opponent=<id>` lets the H2H page deep-link straight into a rematch.
  const { opponent } = await searchParams;

  const [me, friends, teams] = await Promise.all([
    getProfile(supabase, user.id),
    getFriends(supabase),
    getTeams(supabase),
  ]);

  if (!me) redirect("/auth/signout");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log a match</h1>
        <p className="text-sm text-muted-foreground">
          The winner is worked out from the score.
        </p>
      </div>

      {friends.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No friends yet"
          description="Matches are logged against people on your friends list. Add someone first."
          action={{ href: "/friends", label: "Find friends" }}
        />
      ) : (
        <AddMatchForm
          me={me}
          friends={friends}
          teams={teams}
          defaultOpponentId={
            typeof opponent === "string" ? opponent : undefined
          }
        />
      )}
    </div>
  );
}
