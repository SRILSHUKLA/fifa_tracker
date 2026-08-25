import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeagueList } from "@/components/leagues/league-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/queries/groups";
import { getGroupLeagues, getMyLeagues, getParticipantCounts } from "@/lib/queries/leagues";

export const metadata: Metadata = { title: "Leagues · Bragging Rights" };

export default async function LeaguesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [myGroups, myLeagues] = await Promise.all([
    getMyGroups(supabase, user.id),
    getMyLeagues(supabase, user.id),
  ]);

  // Draft leagues are shown from every group the user is in (so there is a
  // path to discover and join one), but in-progress/completed leagues only
  // show up here once joined — this tab is for "leagues you're playing in",
  // not a second copy of every group's history.
  const groupLeagues = (
    await Promise.all(myGroups.map(({ group }) => getGroupLeagues(supabase, group.id)))
  ).flat();

  const openToJoin = groupLeagues.filter((league) => league.status === "draft");
  const inProgress = myLeagues
    .map((m) => m.league)
    .filter((league) => league.status === "in_progress");
  const completed = myLeagues
    .map((m) => m.league)
    .filter((league) => league.status === "completed");

  const allIds = [...new Set([...openToJoin, ...inProgress, ...completed].map((l) => l.id))];
  const counts = await getParticipantCounts(supabase, allIds);

  const hasAnyLeague = openToJoin.length + inProgress.length + completed.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leagues</h1>
        <p className="text-sm text-muted-foreground">
          Round robins and knockouts across every group you&apos;re in.
        </p>
      </div>

      {myGroups.length > 0 && (
        <Button asChild variant="outline" className="h-12 w-full">
          <Link href="/leagues/new">
            <Trophy className="size-4" />
            Start a league
          </Link>
        </Button>
      )}

      {!hasAnyLeague ? (
        <EmptyState
          icon={Trophy}
          title="No leagues yet"
          description={
            myGroups.length > 0
              ? "Start a round robin or knockout in one of your groups."
              : "Leagues live inside a group. Create or join one first."
          }
          action={myGroups.length === 0 ? { href: "/groups", label: "Find a group" } : undefined}
        />
      ) : (
        <>
          {inProgress.length > 0 && (
            <section aria-labelledby="in-progress-heading" className="space-y-3">
              <h2 id="in-progress-heading" className="text-sm font-semibold">
                In progress
              </h2>
              <LeagueList leagues={inProgress} participantCounts={counts} />
            </section>
          )}

          {openToJoin.length > 0 && (
            <section aria-labelledby="open-heading" className="space-y-3">
              <h2 id="open-heading" className="text-sm font-semibold">
                Open to join
              </h2>
              <LeagueList leagues={openToJoin} participantCounts={counts} />
            </section>
          )}

          {completed.length > 0 && (
            <section aria-labelledby="completed-heading" className="space-y-3">
              <h2 id="completed-heading" className="text-sm font-semibold">
                Completed
              </h2>
              <LeagueList leagues={completed} participantCounts={counts} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
