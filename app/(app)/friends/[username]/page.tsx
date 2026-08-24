import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { UnfriendButton } from "@/components/friends/unfriend-button";
import { MatchCard } from "@/components/match/match-card";
import { PlayerAvatar } from "@/components/player-avatar";
import { ResultBar, StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { decimal, displayName, matchDate } from "@/lib/format";
import { getMatches } from "@/lib/queries/matches";
import { getH2HStats, getProfileByUsername } from "@/lib/queries/stats";

export async function generateMetadata({
  params,
}: PageProps<"/friends/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} · FIFA Tracker` };
}

export default async function HeadToHeadPage({
  params,
}: PageProps<"/friends/[username]">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { username } = await params;
  const opponent = await getProfileByUsername(supabase, username);

  if (!opponent) notFound();
  // Your own page is the dashboard, not a head-to-head against yourself.
  if (opponent.id === user.id) redirect("/");

  const [stats, matches, { data: isFriend }] = await Promise.all([
    getH2HStats(supabase, opponent.id),
    getMatches(supabase, {
      playerId: user.id,
      opponentId: opponent.id,
      limit: 20,
    }),
    supabase.rpc("are_friends", { a: user.id, b: opponent.id }),
  ]);

  const name = displayName(opponent);
  const decided = stats.wins + stats.losses;

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
      >
        <Link href="/friends">
          <ArrowLeft className="size-4" />
          Friends
        </Link>
      </Button>

      {/* Header --------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <PlayerAvatar person={opponent} size="lg" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-tight tracking-tight">
            {name}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            @{opponent.username}
            {stats.last_played && ` · last played ${matchDate(stats.last_played)}`}
          </p>
        </div>

        {isFriend && (
          <UnfriendButton
            friendId={opponent.id}
            username={opponent.username}
          />
        )}
      </div>

      {/* Head to head --------------------------------------------------- */}
      <section
        aria-labelledby="h2h-heading"
        className="rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="h2h-heading" className="text-sm font-semibold">
            Head to head
          </h2>
          <span className="tnum text-sm text-muted-foreground">
            {stats.played} {stats.played === 1 ? "match" : "matches"}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-center">
          <div className="flex-1">
            <p className="tnum text-3xl font-bold leading-none text-win">
              {stats.wins}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              You
            </p>
          </div>
          <div className="flex-1">
            <p className="tnum text-3xl font-bold leading-none text-draw">
              {stats.draws}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Drawn
            </p>
          </div>
          <div className="flex-1">
            <p className="tnum text-3xl font-bold leading-none text-loss">
              {stats.losses}
            </p>
            <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {name}
            </p>
          </div>
        </div>

        <ResultBar
          wins={stats.wins}
          draws={stats.draws}
          losses={stats.losses}
          className="mt-4"
        />

        {decided > 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {stats.wins > stats.losses
              ? `You lead this rivalry by ${stats.wins - stats.losses}.`
              : stats.wins < stats.losses
                ? `${name} leads this rivalry by ${stats.losses - stats.wins}.`
                : "Dead level."}
          </p>
        )}
      </section>

      {/* Goals ---------------------------------------------------------- */}
      <section className="grid grid-cols-2 gap-2">
        <StatTile
          label="Goals scored"
          value={stats.goals_for}
          sub={`${decimal(stats.avg_goals_for)} per match`}
          tone="win"
        />
        <StatTile
          label="Goals conceded"
          value={stats.goals_against}
          sub={`${decimal(stats.avg_goals_against)} per match`}
          tone="loss"
        />
      </section>

      {stats.played > 0 && (
        <section className="grid grid-cols-2 gap-2">
          <StatTile
            label="Goal diff"
            value={
              stats.goals_for - stats.goals_against > 0
                ? `+${stats.goals_for - stats.goals_against}`
                : `${stats.goals_for - stats.goals_against}`
            }
            tone={
              stats.goals_for > stats.goals_against
                ? "win"
                : stats.goals_for < stats.goals_against
                  ? "loss"
                  : "draw"
            }
          />
          <StatTile
            label="Biggest win"
            value={
              stats.biggest_win_margin > 0
                ? `+${stats.biggest_win_margin}`
                : "—"
            }
            sub={stats.biggest_win_margin > 0 ? "goal margin" : "no wins yet"}
          />
        </section>
      )}

      {isFriend && (
        <Button asChild className="h-12 w-full text-base">
          <Link href={`/match/new?opponent=${opponent.id}`}>
            <Swords className="size-4" />
            Log a match v {name}
          </Link>
        </Button>
      )}

      {/* Meetings ------------------------------------------------------- */}
      <section aria-labelledby="meetings-heading" className="space-y-3">
        <h2 id="meetings-heading" className="text-sm font-semibold">
          Previous meetings
        </h2>

        {matches.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="You have never played"
            description={`Log a result against ${name} and the head-to-head starts here.`}
            action={
              isFriend
                ? {
                    href: `/match/new?opponent=${opponent.id}`,
                    label: "Log a match",
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                viewerId={user.id}
                showOpponentLink={false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
