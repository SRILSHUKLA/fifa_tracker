import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { ChampionBanner } from "@/components/leagues/champion-banner";
import { JoinLeagueForm } from "@/components/leagues/join-league-form";
import { LeagueFixtureList } from "@/components/leagues/league-fixture-list";
import { LeagueStandingsTable } from "@/components/leagues/league-standings-table";
import { LeagueStatusBadge } from "@/components/leagues/league-status-badge";
import { leagueTypeDescription, leagueTypeLabel } from "@/components/leagues/league-type-label";
import { LeaveLeagueButton } from "@/components/leagues/leave-league-button";
import { StartLeagueButton } from "@/components/leagues/start-league-button";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamBadge } from "@/components/team-badge";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/format";
import { getGroup } from "@/lib/queries/groups";
import {
  getLeague,
  getLeagueFixtures,
  getLeagueParticipants,
  getLeagueStandings,
} from "@/lib/queries/leagues";
import { getTeams } from "@/lib/queries/teams";

export async function generateMetadata({
  params,
}: PageProps<"/leagues/[leagueId]">): Promise<Metadata> {
  const { leagueId } = await params;
  const supabase = await createClient();
  const league = await getLeague(supabase, leagueId);
  return { title: league ? `${league.name} · Bragging Rights` : "League · Bragging Rights" };
}

export default async function LeagueDetailPage({
  params,
}: PageProps<"/leagues/[leagueId]">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { leagueId } = await params;

  // RLS scopes `leagues` SELECT to the league's group members only, so a
  // non-member (or a bad id) resolves to null here — same pattern as the
  // group detail page, no separate membership check needed.
  const league = await getLeague(supabase, leagueId);
  if (!league) notFound();

  const [group, participants, fixtures, standings, teams] = await Promise.all([
    getGroup(supabase, league.group_id),
    getLeagueParticipants(supabase, leagueId),
    getLeagueFixtures(supabase, leagueId),
    getLeagueStandings(supabase, leagueId),
    getTeams(supabase),
  ]);

  if (!group) notFound();

  const isParticipant = participants.some((p) => p.user_id === user.id);
  const isCreator = league.created_by === user.id;
  const minParticipants =
    league.type === "round_robin_knockout" ? (league.knockout_size ?? 2) : 2;

  const championParticipant = league.champion_id
    ? participants.find((p) => p.user_id === league.champion_id)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <span className="truncate">{group.name}</span>
        </p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{league.name}</h1>
          <LeagueStatusBadge status={league.status} className="mt-1 shrink-0" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {leagueTypeLabel(league.type)} · {leagueTypeDescription(league.type)}
        </p>
      </div>

      {league.status === "completed" && championParticipant && (
        <ChampionBanner champion={championParticipant.profile} />
      )}

      {league.status === "draft" && (
        <div className="space-y-3">
          {!isParticipant && <JoinLeagueForm leagueId={league.id} teams={teams} />}
          {isCreator && (
            <StartLeagueButton
              leagueId={league.id}
              participantCount={participants.length}
              minParticipants={minParticipants}
            />
          )}
          {isParticipant && !isCreator && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Waiting for the league creator to start it. Fixtures appear the
                moment they do.
              </p>
              <LeaveLeagueButton leagueId={league.id} />
            </div>
          )}
        </div>
      )}

      {/* Roster --------------------------------------------------------- */}
      <section aria-labelledby="roster-heading" className="space-y-3">
        <h2 id="roster-heading" className="text-sm font-semibold">
          Players ({participants.length})
        </h2>
        <ul className="space-y-2">
          {participants.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
            >
              <PlayerAvatar person={p.profile} size="sm" highlight={p.user_id === user.id} />
              <span className="min-w-0 flex-1 truncate font-medium">{displayName(p.profile)}</span>
              <TeamBadge team={p.team} size="sm" />
              <span className="truncate text-xs text-muted-foreground">{p.team.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Standings + fixtures — only once the league is under way ------- */}
      {league.status !== "draft" && (
        <>
          <section aria-labelledby="standings-heading" className="space-y-3">
            <h2 id="standings-heading" className="text-sm font-semibold">
              Standings
            </h2>
            <LeagueStandingsTable
              standings={standings}
              viewerId={user.id}
              groupId={group.id}
              teams={teams}
            />
          </section>

          <section aria-labelledby="fixtures-heading" className="space-y-3">
            <h2 id="fixtures-heading" className="flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="size-4 text-muted-foreground" />
              Fixtures
            </h2>
            <LeagueFixtureList fixtures={fixtures} leagueId={league.id} viewerId={user.id} />
          </section>
        </>
      )}
    </div>
  );
}
