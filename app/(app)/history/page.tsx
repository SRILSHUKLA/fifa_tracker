import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Swords, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { MatchCard } from "@/components/match/match-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getActiveGroup } from "@/lib/groups/active-group";
import { getMatches } from "@/lib/queries/matches";

export const metadata: Metadata = { title: "History · Bragging Rights" };

const PAGE_SIZE = 20;

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
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
          <h1 className="text-2xl font-bold tracking-tight">Match history</h1>
        </div>
        <EmptyState
          icon={UsersRound}
          title="No group yet"
          description="History is scoped to a group. Create or join one first."
          action={{ href: "/groups", label: "Find a group" }}
        />
      </div>
    );
  }

  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(String(page ?? "1"), 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  // Fetch one extra row to find out whether another page exists, which is
  // cheaper than a second count query.
  const rows = await getMatches(supabase, {
    groupId: active.group.id,
    playerId: user.id,
    limit: PAGE_SIZE + 1,
    offset,
  });

  const matches = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Match history</h1>
        <p className="text-sm text-muted-foreground">
          {active.group.name} · every match you have played, newest first.
        </p>
      </div>

      {matches.length === 0 ? (
        <EmptyState
          icon={pageNumber === 1 ? Swords : History}
          title={pageNumber === 1 ? "No matches yet" : "Nothing on this page"}
          description={
            pageNumber === 1
              ? "Your results will appear here once you log one."
              : "You have reached the end of your history."
          }
          action={
            pageNumber === 1
              ? { href: `/match/new?group=${active.group.id}`, label: "Log a match" }
              : { href: "/history", label: "Back to the start" }
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} viewerId={user.id} />
            ))}
          </div>

          {(pageNumber > 1 || hasMore) && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                asChild
                variant="outline"
                disabled={pageNumber === 1}
                className={pageNumber === 1 ? "pointer-events-none opacity-40" : ""}
              >
                <Link href={`/history?page=${pageNumber - 1}`}>Newer</Link>
              </Button>

              <span className="tnum text-sm text-muted-foreground">
                Page {pageNumber}
              </span>

              <Button
                asChild
                variant="outline"
                disabled={!hasMore}
                className={!hasMore ? "pointer-events-none opacity-40" : ""}
              >
                <Link href={`/history?page=${pageNumber + 1}`}>Older</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
