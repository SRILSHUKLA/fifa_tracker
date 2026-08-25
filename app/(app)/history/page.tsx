import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Swords, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { EditMatchButton } from "@/components/match/edit-match-dialog";
import { MatchCard } from "@/components/match/match-card";
import { FormGuide, ResultBar, StatTile } from "@/components/stat-tile";
import { TeamBadge } from "@/components/team-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { decimal, signed } from "@/lib/format";
import { getActiveGroup } from "@/lib/groups/active-group";
import { getGroupLeaderboard } from "@/lib/queries/groups";
import { getMatches } from "@/lib/queries/matches";
import { getGroupTeamStats, getRecentForm } from "@/lib/queries/stats";
import { getTeams } from "@/lib/queries/teams";

export const metadata: Metadata = { title: "Your stats · Bragging Rights" };

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
          <h1 className="text-2xl font-bold tracking-tight">Your stats</h1>
        </div>
        <EmptyState
          icon={UsersRound}
          title="No group yet"
          description="Stats and history are scoped to a group. Create or join one first."
          action={{ href: "/groups", label: "Find a group" }}
        />
      </div>
    );
  }

  const groupId = active.group.id;
  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(String(page ?? "1"), 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const [leaderboard, teamStats, teams, form, rows] = await Promise.all([
    getGroupLeaderboard(supabase, groupId),
    getGroupTeamStats(supabase, groupId),
    getTeams(supabase),
    getRecentForm(supabase, user.id, groupId, 5),
    // One extra row to find out whether another history page exists —
    // cheaper than a second count query.
    getMatches(supabase, { groupId, playerId: user.id, limit: PAGE_SIZE + 1, offset }),
  ]);

  const matches = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;

  const stats = leaderboard.find((row) => row.id === user.id) ?? null;
  const played = stats?.played ?? 0;

  // Ranked by win rate (min one game, which every row here already has),
  // ties broken by matches played so a fluke 1-0 doesn't outrank a proven
  // record — the "best teams" answer to "which team do I actually win with".
  const rankedTeams = [...teamStats].sort((a, b) => {
    const winPctA = a.wins / a.played;
    const winPctB = b.wins / b.played;
    if (winPctB !== winPctA) return winPctB - winPctA;
    return b.played - a.played;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your stats</h1>
        <p className="text-sm text-muted-foreground">{active.group.name}</p>
      </div>

      {/* Overview ------------------------------------------------------- */}
      <section
        aria-labelledby="record-heading"
        className="rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="record-heading" className="text-sm font-semibold">
            Your record
          </h2>
          <span className="tnum text-sm text-muted-foreground">
            {played} {played === 1 ? "match" : "matches"}
          </span>
        </div>

        <div className="mt-3 flex items-end gap-4">
          <div>
            <p className="tnum text-4xl font-bold leading-none text-primary">
              {stats?.points ?? 0}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Points
            </p>
          </div>

          <div className="flex-1 pb-1">
            <ResultBar
              wins={stats?.wins ?? 0}
              draws={stats?.draws ?? 0}
              losses={stats?.losses ?? 0}
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-win">{stats?.wins ?? 0}W</span>
              <span className="text-draw">{stats?.draws ?? 0}D</span>
              <span className="text-loss">{stats?.losses ?? 0}L</span>
            </div>
          </div>
        </div>

        {form.length > 0 && (
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Form
            </span>
            <FormGuide results={form} />
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <StatTile
          label="Win rate"
          value={stats?.win_pct != null ? `${decimal(stats.win_pct)}%` : "—"}
        />
        <StatTile
          label="Goal diff"
          value={signed(stats?.goal_difference ?? 0)}
          tone={
            (stats?.goal_difference ?? 0) > 0
              ? "win"
              : (stats?.goal_difference ?? 0) < 0
                ? "loss"
                : "draw"
          }
        />
        <StatTile
          label="Table spot"
          value={
            // getGroupLeaderboard already returns rows in ranked order
            // (points, then goal difference, then goals for, then name).
            stats ? `#${leaderboard.filter((r) => r.played > 0).findIndex((r) => r.id === user.id) + 1}` : "—"
          }
        />
      </section>

      {/* Current standings ------------------------------------------------ */}
      <section aria-labelledby="standings-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="standings-heading" className="text-sm font-semibold">
            Current standings
          </h2>
          <Link href="/leaderboard" className="text-sm font-medium text-primary">
            Full table
          </Link>
        </div>
        <LeaderboardTable
          rows={leaderboard.filter((r) => r.played > 0)}
          viewerId={user.id}
          groupId={groupId}
        />
      </section>

      {/* Best teams --------------------------------------------------------- */}
      {rankedTeams.length > 0 && (
        <section aria-labelledby="best-teams-heading" className="space-y-3">
          <h2 id="best-teams-heading" className="text-sm font-semibold">
            Your best teams
          </h2>
          <ul className="space-y-2">
            {rankedTeams.map((team) => {
              const winPct = (team.wins / team.played) * 100;
              const teamInfo = teams.find((t) => t.id === team.team_id) ?? null;

              return (
                <li
                  key={team.team_id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <TeamBadge team={teamInfo ?? { name: team.team_name }} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{team.team_name}</p>
                    <p className="tnum text-xs text-muted-foreground">
                      {team.wins}W {team.draws}D {team.losses}L · {team.played}{" "}
                      {team.played === 1 ? "match" : "matches"}
                    </p>
                  </div>
                  <p className="tnum shrink-0 text-lg font-bold text-primary">
                    {decimal(winPct)}%
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Match history ------------------------------------------------------ */}
      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-sm font-semibold">
          Match history
        </h2>

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
                ? { href: `/match/new?group=${groupId}`, label: "Log a match" }
                : { href: "/history", label: "Back to the start" }
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  viewerId={user.id}
                  action={
                    match.created_by === user.id ? (
                      <EditMatchButton match={match} viewerId={user.id} teams={teams} />
                    ) : undefined
                  }
                />
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
      </section>
    </div>
  );
}
