import Link from "next/link";

import { PlayerAvatar } from "@/components/player-avatar";
import { TeamBadge } from "@/components/team-badge";
import { displayName, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeagueStandingRow, Team } from "@/types/database.types";

/**
 * Round-robin-stage standings for one league. Same table shape as the
 * group leaderboard on app/(app)/leaderboard/page.tsx, plus each player's
 * locked-in league team. Knockout results never affect this table — see
 * get_league_standings in 0005_leagues.sql.
 */
export function LeagueStandingsTable({
  standings,
  viewerId,
  groupId,
  teams,
}: {
  standings: LeagueStandingRow[];
  viewerId: string;
  groupId: string;
  teams: Team[];
}) {
  if (standings.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[440px] text-sm">
        <thead>
          <tr className="border-b border-border bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-2 pl-3 pr-1 text-left font-medium">
              #
            </th>
            <th scope="col" className="py-2 text-left font-medium">
              Player
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium">
              P
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium">
              W
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium">
              D
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium">
              L
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium">
              GD
            </th>
            <th scope="col" className="py-2 pl-1.5 pr-3 text-right font-medium">
              Pts
            </th>
          </tr>
        </thead>

        <tbody>
          {standings.map((row, index) => {
            const isMe = row.id === viewerId;
            const team = teams.find((t) => t.id === row.team_id) ?? { name: row.team_name };

            return (
              <tr
                key={row.id}
                className={cn("border-b border-border/60 last:border-0", isMe && "bg-primary/10")}
              >
                <td
                  className={cn(
                    "tnum py-2.5 pl-3 pr-1 text-left font-semibold",
                    index === 0 ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {index + 1}
                </td>

                <td className="py-2.5 pr-2">
                  <Link
                    href={isMe ? "/" : `/groups/${groupId}/members/${row.username}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <PlayerAvatar person={row} size="sm" highlight={isMe} />
                    <span className="min-w-0 truncate font-medium">{displayName(row)}</span>
                    <TeamBadge team={team} size="sm" className="size-4 shrink-0" />
                  </Link>
                </td>

                <td className="tnum px-1.5 py-2.5 text-right text-muted-foreground">
                  {row.played}
                </td>
                <td className="tnum px-1.5 py-2.5 text-right">{row.wins}</td>
                <td className="tnum px-1.5 py-2.5 text-right">{row.draws}</td>
                <td className="tnum px-1.5 py-2.5 text-right">{row.losses}</td>
                <td
                  className={cn(
                    "tnum px-1.5 py-2.5 text-right",
                    row.goal_difference > 0 && "text-win",
                    row.goal_difference < 0 && "text-loss",
                  )}
                >
                  {signed(row.goal_difference)}
                </td>
                <td className="tnum py-2.5 pl-1.5 pr-3 text-right font-bold">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
