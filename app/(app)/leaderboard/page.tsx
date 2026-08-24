import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PlayerAvatar } from "@/components/player-avatar";
import { createClient } from "@/lib/supabase/server";
import { displayName, signed } from "@/lib/format";
import { getLeaderboard } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboard · FIFA Tracker" };

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rows = await getLeaderboard(supabase);

  // Everyone with a profile appears in the view. Players who have not played
  // yet would all sit on zero points, so they are listed separately below
  // rather than padding out the table.
  const ranked = rows.filter((row) => row.played > 0);
  const unranked = rows.filter((row) => row.played === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          3 points a win, 1 a draw. Ties split on goal difference.
        </p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nothing to rank yet"
          description="The table fills up as soon as the first match is logged."
          action={{ href: "/match/new", label: "Log a match" }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
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
              {ranked.map((row, index) => {
                const isMe = row.id === user.id;

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
                        href={isMe ? "/" : `/friends/${row.username}`}
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
                    <td className="tnum py-2.5 pl-1.5 pr-3 text-right font-bold">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                href={row.id === user.id ? "/" : `/friends/${row.username}`}
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
