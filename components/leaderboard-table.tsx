import Link from "next/link";

import { PlayerAvatar } from "@/components/player-avatar";
import { decimal, displayName, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GroupLeaderboardRow } from "@/types/database.types";

/**
 * The group leaderboard table — one full-column ranked table, split from
 * the "yet to play" chip row below it. Shared by the /leaderboard page and
 * the profile stats page ("Current standings") so both stay in sync.
 */
export function LeaderboardTable({
  rows,
  viewerId,
  groupId,
}: {
  rows: GroupLeaderboardRow[];
  viewerId: string;
  groupId: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[420px] text-sm">
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
            <th scope="col" className="px-1.5 py-2 text-right font-medium">
              Win%
            </th>
            <th scope="col" className="py-2 pl-1.5 pr-3 text-right font-medium">
              Pts
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const isMe = row.id === viewerId;

            return (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  isMe && "bg-primary/10",
                )}
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
                    href={isMe ? "/history" : `/groups/${groupId}/members/${row.username}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <PlayerAvatar person={row} size="sm" highlight={isMe} />
                    <span className="min-w-0 truncate font-medium">
                      {displayName(row)}
                    </span>
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
                <td className="tnum px-1.5 py-2.5 text-right text-muted-foreground">
                  {row.win_pct != null ? `${decimal(row.win_pct)}%` : "—"}
                </td>
                <td className="tnum py-2.5 pl-1.5 pr-3 text-right font-bold">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
