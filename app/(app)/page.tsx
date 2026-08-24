import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Swords, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { MatchCard } from "@/components/match/match-card";
import { FormGuide, ResultBar, StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { decimal, displayName, signed } from "@/lib/format";
import { getActiveGroup } from "@/lib/groups/active-group";
import { getGroupLeaderboard } from "@/lib/queries/groups";
import { getMatches } from "@/lib/queries/matches";
import { getProfile, getRecentForm } from "@/lib/queries/stats";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [me, { active }] = await Promise.all([
    getProfile(supabase, user.id),
    getActiveGroup(supabase),
  ]);

  if (!me) redirect("/auth/signout");

  if (!active) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Welcome</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {displayName(me)}
          </h1>
        </div>

        <EmptyState
          icon={UsersRound}
          title="Get your group set up"
          description="Create a group and share the invite code with your friends, or join a group someone shared with you, to start tracking matches."
          action={{ href: "/groups", label: "Create or join a group" }}
        />
      </div>
    );
  }

  const groupId = active.group.id;

  const [leaderboard, form, matches] = await Promise.all([
    getGroupLeaderboard(supabase, groupId),
    getRecentForm(supabase, user.id, groupId, 5),
    getMatches(supabase, { groupId, playerId: user.id, limit: 5 }),
  ]);

  const stats = leaderboard.find((row) => row.id === user.id) ?? null;
  const played = stats?.played ?? 0;
  const goalsFor = stats?.goals_for ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Welcome back · {active.group.name}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {displayName(me)}
        </h1>
      </div>

      {/* Headline record ---------------------------------------------------- */}
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

      {/* Goal stats --------------------------------------------------------- */}
      <section className="grid grid-cols-3 gap-2">
        <StatTile label="Scored" value={goalsFor} />
        <StatTile label="Conceded" value={stats?.goals_against ?? 0} />
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
      </section>

      {played > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {decimal(goalsFor / played)} goals scored per match ·{" "}
          {decimal(stats?.win_pct)}% win rate
        </p>
      )}

      {/* Recent matches ----------------------------------------------------- */}
      <section aria-labelledby="recent-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="recent-heading" className="text-sm font-semibold">
            Recent matches
          </h2>
          {matches.length > 0 && (
            <Link
              href="/history"
              className="flex items-center text-sm font-medium text-primary"
            >
              See all
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>

        {matches.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No matches yet"
            description="Log your first result and your stats will start filling in."
            action={{ href: `/match/new?group=${groupId}`, label: "Log a match" }}
          />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} viewerId={user.id} />
            ))}
          </div>
        )}
      </section>

      <div className="pt-1 text-center">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/groups/${groupId}`}>
            View {active.group.name}
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
