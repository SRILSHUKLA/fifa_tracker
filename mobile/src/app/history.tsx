import { useRouter } from "expo-router";
import { ChevronRight, Pencil } from "lucide-react-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { BackButton, Num } from "@/components/screen";
import { MatchCard } from "@/components/match-card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { TeamBadge } from "@/components/team-badge";
import { StatTile, RecordCard } from "@/components/stat-tile";
import { useAuth } from "@/lib/auth";
import { useActiveGroup } from "@/lib/active-group";
import {
  PAGE_SIZE,
  useGroupTeamStats,
  useLeaderboard,
  useMatches,
  useRecentForm,
  useTeams,
} from "@/lib/hooks";
import { decimal, signed } from "@/lib/format";

export default function HistoryScreen(): JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(1);

  const { session } = useAuth();
  const userId = session?.user.id;
  const { group } = useActiveGroup();

  const leaderboard = useLeaderboard(group?.id ?? "");
  const teamStats = useGroupTeamStats(group?.id ?? "");
  const form = useRecentForm(userId, group?.id);
  const matches = useMatches({
    groupId: group?.id,
    playerId: userId,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  const teams = useTeams();

  if (!userId) return null;

  if (!group) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Home" />
        </View>
        <ScrollView contentContainerClassName="px-4 pb-16 pt-2">
          <Text className="mb-5 text-[26px] font-bold tracking-tight text-foreground">
            Your stats
          </Text>
          <EmptyState
            icon={ChevronRight}
            title="No group yet"
            description="Stats and history are scoped to a group. Create or join one first."
            action={{ href: "/groups", label: "Find a group" }}
          />
        </ScrollView>
      </View>
    );
  }

  const stats =
    (leaderboard.data ?? []).find((row) => row.id === userId) ?? null;
  const played = stats?.played ?? 0;

  // One extra row tells us whether another history page exists — cheaper
  // than a second count query.
  const rows = matches.data ?? [];
  const matchesPage = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;

  // Ranked by win rate (ties broken by matches played) — "which team do I
  // actually win with".
  const rankedTeams = [...(teamStats.data ?? [])].sort((a, b) => {
    const winPctA = a.wins / a.played;
    const winPctB = b.wins / b.played;
    if (winPctB !== winPctA) return winPctB - winPctA;
    return b.played - a.played;
  });

  const rankedRows = (leaderboard.data ?? []).filter((r) => r.played > 0);
  const tableSpot = stats
    ? `#${rankedRows.findIndex((r) => r.id === userId) + 1}`
    : "—";

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center px-2">
        <BackButton label="Home" />
      </View>

      <ScrollView contentContainerClassName="px-4 pb-16 pt-1">
        <View className="mb-5">
          <Text className="text-[26px] leading-8 font-bold tracking-tight text-foreground">
            Your stats
          </Text>
          <Text className="mt-0.5 text-sm text-muted">{group.name}</Text>
        </View>

        <RecordCard
          heading="Your record"
          played={played}
          points={stats?.points ?? 0}
          wins={stats?.wins ?? 0}
          draws={stats?.draws ?? 0}
          losses={stats?.losses ?? 0}
          form={form.data ?? []}
        />

        <View className="mt-4 flex-row gap-2">
          <StatTile
            label="Win rate"
            value={stats?.win_pct != null ? `${decimal(stats.win_pct)}%` : "—"}
            className="flex-1"
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
            className="flex-1"
          />
          <StatTile label="Table spot" value={tableSpot} className="flex-1" />
        </View>

        {/* Current standings ------------------------------------------- */}
        {rankedRows.length > 0 && (
          <View className="mt-6 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">
                Current standings
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/leaderboard")}
              >
                <Text className="text-sm font-medium text-accent">
                  Full table
                </Text>
              </Pressable>
            </View>
            <LeaderboardTable
              rows={rankedRows}
              viewerId={userId}
              groupId={group.id}
            />
          </View>
        )}

        {/* Best teams --------------------------------------------------- */}
        {rankedTeams.length > 0 && (
          <View className="mt-6 gap-3">
            <Text className="text-sm font-semibold text-foreground">
              Your best teams
            </Text>
            <View className="gap-2">
              {rankedTeams.map((team) => {
                const winPct = (team.wins / team.played) * 100;
                const teamInfo =
                  (teams.data ?? []).find((t) => t.id === team.team_id) ?? {
                    name: team.team_name,
                  };

                return (
                  <View
                    key={team.team_id}
                    className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3"
                  >
                    <TeamBadge team={teamInfo} size="md" />
                    <View className="min-w-0 flex-1">
                      <Text
                        numberOfLines={1}
                        className="font-medium leading-tight text-foreground"
                      >
                        {team.team_name}
                      </Text>
                      <Num className="text-xs text-muted">
                        {`${team.wins}W ${team.draws}D ${team.losses}L · ${team.played} ${team.played === 1 ? "match" : "matches"}`}
                      </Num>
                    </View>
                    <Num className="shrink-0 text-lg font-bold text-accent">
                      {`${decimal(winPct)}%`}
                    </Num>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Match history -------------------------------------------------- */}
        <View className="mt-6 gap-3">
          <Text className="text-sm font-semibold text-foreground">
            Match history
          </Text>

          {matchesPage.length === 0 ? (
            <EmptyState
              icon={ChevronRight}
              title={page === 1 ? "No matches yet" : "Nothing on this page"}
              description={
                page === 1
                  ? "Your results will appear here once you log one."
                  : "You have reached the end of your history."
              }
              action={
                page > 1
                  ? undefined
                  : {
                      href: `/match/new?group=${group.id}`,
                      label: "Log a match",
                    }
              }
            />
          ) : (
            <>
              <View className="gap-2">
                {matchesPage.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    viewerId={userId}
                    action={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Edit this result"
                        onPress={() =>
                          router.push(`/match/edit?matchId=${match.id}`)
                        }
                        className="w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface active:opacity-60"
                      >
                        <Pencil size={15} color="#a1a1aa" strokeWidth={2} />
                      </Pressable>
                    }
                  />
                ))}
              </View>

              {(page > 1 || hasMore) && (
                <View className="flex-row items-center justify-between gap-3 pt-1">
                  <Pressable
                    disabled={page === 1}
                    onPress={() => setPage(page - 1)}
                    className={`rounded-xl border border-border bg-surface px-4 py-2.5 active:opacity-60 ${
                      page === 1 ? "opacity-40" : ""
                    }`}
                  >
                    <Text className="text-sm font-medium text-foreground">
                      Newer
                    </Text>
                  </Pressable>

                  <Num className="text-sm text-muted">{`Page ${page}`}</Num>

                  <Pressable
                    disabled={!hasMore}
                    onPress={() => setPage(page + 1)}
                    className={`rounded-xl border border-border bg-surface px-4 py-2.5 active:opacity-60 ${
                      !hasMore ? "opacity-40" : ""
                    }`}
                  >
                    <Text className="text-sm font-medium text-foreground">
                      Older
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
