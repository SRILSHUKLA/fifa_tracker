import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { LeagueStatusBadge } from "@/components/leagues/league-status-badge";
import { leagueTypeLabel } from "@/components/leagues/league-type-label";
import type { League } from "@/types/database.types";

/** Every league in a list — the group page's "Leagues" section and the
 * cross-group /leagues index both render this. */
export function LeagueList({
  leagues,
  participantCounts,
}: {
  leagues: League[];
  participantCounts: Record<string, number>;
}) {
  return (
    <ul className="space-y-2">
      {leagues.map((league) => {
        const count = participantCounts[league.id] ?? 0;

        return (
          <li key={league.id}>
            <Link
              href={`/leagues/${league.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-opacity active:opacity-70"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{league.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {leagueTypeLabel(league.type)} · {count}{" "}
                  {count === 1 ? "player" : "players"}
                </p>
              </div>
              <LeagueStatusBadge status={league.status} className="shrink-0" />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
