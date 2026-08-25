import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Swords, Trophy } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { InviteShare } from "@/components/groups/invite-share";
import { LeaveGroupButton } from "@/components/groups/leave-group-button";
import { MemberList, MemberRow } from "@/components/groups/member-list";
import { RemoveMemberButton } from "@/components/groups/remove-member-button";
import { RenameGroupDialog } from "@/components/groups/rename-group-dialog";
import { LeagueList } from "@/components/leagues/league-list";
import { MatchCard } from "@/components/match/match-card";
import { FormGuide, ResultBar, StatTile } from "@/components/stat-tile";
import { TeamBadge } from "@/components/team-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { decimal, signed } from "@/lib/format";
import { getMatches } from "@/lib/queries/matches";
import {
  getGroup,
  getGroupLeaderboard,
  getGroupMembers,
} from "@/lib/queries/groups";
import {
  getGroupLeagues,
  getParticipantCounts,
} from "@/lib/queries/leagues";
import { getGroupTeamStats, getRecentForm } from "@/lib/queries/stats";
import { getTeams } from "@/lib/queries/teams";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[groupId]">): Promise<Metadata> {
  const { groupId } = await params;
  const supabase = await createClient();
  const group = await getGroup(supabase, groupId);
  return { title: group ? `${group.name} · Bragging Rights` : "Group · Bragging Rights" };
}

export default async function GroupDetailPage({
  params,
}: PageProps<"/groups/[groupId]">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { groupId } = await params;

  // RLS scopes `groups` SELECT to members only, so a non-member (or a bad
  // id) resolves to null here exactly the same way — no separate membership
  // check is needed.
  const group = await getGroup(supabase, groupId);
  if (!group) notFound();

  const [members, leaderboard, matches, form, teamStats, teams, leagues] = await Promise.all([
    getGroupMembers(supabase, groupId),
    getGroupLeaderboard(supabase, groupId),
    getMatches(supabase, { groupId, limit: 5 }),
    getRecentForm(supabase, user.id, groupId, 5),
    getGroupTeamStats(supabase, groupId),
    getTeams(supabase),
    getGroupLeagues(supabase, groupId),
  ]);
  const leagueParticipantCounts = await getParticipantCounts(
    supabase,
    leagues.map((l) => l.id),
  );

  const isOwner = group.owner_id === user.id;
  const myRow = leaderboard.find((row) => row.id === user.id) ?? null;
  const played = myRow?.played ?? 0;
  const topTeam = teamStats[0] ?? null;
  // get_group_team_stats only returns team_id/team_name, not the logo — the
  // full team list is small enough to already be in memory, so look it up
  // rather than adding a join to that RPC.
  const topTeamInfo = topTeam ? teams.find((t) => t.id === topTeam.team_id) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {group.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isOwner && (
            <RenameGroupDialog groupId={group.id} currentName={group.name} />
          )}
          {!isOwner && (
            <LeaveGroupButton groupId={group.id} groupName={group.name} />
          )}
        </div>
      </div>

      <InviteShare
        groupId={group.id}
        inviteCode={group.invite_code}
        isOwner={isOwner}
      />

      {/* Your stats in this group -------------------------------------- */}
      <section
        aria-labelledby="your-stats-heading"
        className="rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="your-stats-heading" className="text-sm font-semibold">
            Your record here
          </h2>
          <span className="tnum text-sm text-muted-foreground">
            {played} {played === 1 ? "match" : "matches"}
          </span>
        </div>

        <div className="mt-3 flex items-end gap-4">
          <div>
            <p className="tnum text-4xl font-bold leading-none text-primary">
              {myRow?.points ?? 0}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Points
            </p>
          </div>

          <div className="flex-1 pb-1">
            <ResultBar
              wins={myRow?.wins ?? 0}
              draws={myRow?.draws ?? 0}
              losses={myRow?.losses ?? 0}
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-win">{myRow?.wins ?? 0}W</span>
              <span className="text-draw">{myRow?.draws ?? 0}D</span>
              <span className="text-loss">{myRow?.losses ?? 0}L</span>
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
          value={myRow?.win_pct != null ? `${decimal(myRow.win_pct)}%` : "—"}
        />
        <StatTile
          label="Goal diff"
          value={signed(myRow?.goal_difference ?? 0)}
          tone={
            (myRow?.goal_difference ?? 0) > 0
              ? "win"
              : (myRow?.goal_difference ?? 0) < 0
                ? "loss"
                : "draw"
          }
        />
        <StatTile
          label="Table spot"
          value={
            myRow
              ? `#${leaderboard.findIndex((row) => row.id === user.id) + 1}`
              : "—"
          }
        />
      </section>

      {topTeam && (
        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Your go-to team here
          </p>
          <div className="mt-1.5 flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <TeamBadge team={topTeamInfo ?? { name: topTeam.team_name }} size="md" />
              {topTeam.team_name}
            </p>
            <p className="tnum text-sm text-muted-foreground">
              {topTeam.wins}W {topTeam.draws}D {topTeam.losses}L in{" "}
              {topTeam.played} {topTeam.played === 1 ? "match" : "matches"}
            </p>
          </div>
        </section>
      )}

      <Button asChild className="h-12 w-full text-base">
        <Link href={`/match/new?group=${group.id}`}>
          <Swords className="size-4" />
          Log a match
        </Link>
      </Button>

      {/* Leagues ------------------------------------------------------------ */}
      <section aria-labelledby="leagues-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="leagues-heading" className="text-sm font-semibold">
            Leagues
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/leagues/new?group=${group.id}`}>New league</Link>
          </Button>
        </div>

        {leagues.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No leagues yet"
            description="Start a round robin or knockout among this group's members."
            action={{ href: `/leagues/new?group=${group.id}`, label: "Start a league" }}
          />
        ) : (
          <LeagueList leagues={leagues} participantCounts={leagueParticipantCounts} />
        )}
      </section>

      {/* Members ---------------------------------------------------------- */}
      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-sm font-semibold">
          Members
        </h2>

        {isOwner ? (
          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
              >
                <MemberRow member={member} viewerId={user.id} />
                {member.id !== user.id && (
                  <RemoveMemberButton
                    groupId={group.id}
                    memberId={member.id}
                    username={member.username}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <MemberList groupId={group.id} members={members} viewerId={user.id} />
        )}
      </section>

      {/* Recent matches ----------------------------------------------------- */}
      <section aria-labelledby="recent-heading" className="space-y-3">
        <h2 id="recent-heading" className="text-sm font-semibold">
          Recent matches
        </h2>

        {matches.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No matches yet"
            description="Log the first result and this group's stats start filling in."
            action={{ href: `/match/new?group=${group.id}`, label: "Log a match" }}
          />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} viewerId={user.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
