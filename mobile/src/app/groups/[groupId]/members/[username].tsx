import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Swords } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { MatchCard } from "@/components/match-card";
import { PlayerAvatar } from "@/components/player-avatar";
import { BackButton, Num } from "@/components/screen";
import { ResultBar, StatTile } from "@/components/stat-tile";
import { TeamBadge } from "@/components/team-badge";
import { useAuth } from "@/lib/auth";
import {
  useGroup,
  useH2HStats,
  useH2HTeamStats,
  useMatches,
  useProfileByUsername,
} from "@/lib/hooks";
import { decimal, displayName, matchDate } from "@/lib/format";

export default function HeadToHeadScreen(): JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId?: string; username?: string }>();
  const groupId =
    typeof params.groupId === "string" ? params.groupId : "";
  const username =
    typeof params.username === "string"
      ? decodeURIComponent(params.username)
      : "";

  const { session } = useAuth();
  const userId = session?.user.id;

  const groupQuery = useGroup(groupId);
  const opponentQuery = useProfileByUsername(username);

  const opponentId = opponentQuery.data?.id ?? "";
  const stats = useH2HStats(groupId, opponentId);
  const teamStats = useH2HTeamStats(groupId, opponentId);
  const matches = useMatches({
    groupId,
    playerId: userId,
    opponentId,
    limit: 20,
  });

  if (!userId) return null;

  // Your own row is the group page, not a head-to-head against yourself.
  const isSelf = !!opponentQuery.data && opponentQuery.data.id === userId;

  if (!groupQuery.isLoading && !opponentQuery.isLoading && isSelf) {
    return <Redirect href={`/groups/${groupId}`} />;
  }

  const group = groupQuery.data;
  const opponent = opponentQuery.data;

  function refetchAll() {
    stats.refetch();
    teamStats.refetch();
    matches.refetch();
  }

  const isLoading =
    groupQuery.isLoading ||
    opponentQuery.isLoading ||
    stats.isLoading ||
    teamStats.isLoading;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Back" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted">Loading…</Text>
        </View>
      </View>
    );
  }

  if (!group || !opponent || !stats.data || !teamStats.data) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Back" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-muted">
            This player or group could not be found.
          </Text>
        </View>
      </View>
    );
  }

  const name = displayName(opponent);
  const h2h = stats.data;
  const decided = h2h.wins + h2h.losses;
  const gd = h2h.goals_for - h2h.goals_against;

  // "Best pick": most wins among teams played at least twice.
  const bestPickTeamId = (() => {
    const eligible = (teamStats.data ?? []).filter((r) => r.played >= 2);
    if (eligible.length === 0) return null;
    const best = [...eligible].sort((a, b) => b.wins - a.wins)[0];
    return best.wins > 0 ? best.team_id : null;
  })();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center px-2">
        <BackButton label={group.name} />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-16 pt-1"
        refreshControl={
          <RefreshControl
            refreshing={stats.isFetching}
            onRefresh={refetchAll}
            tintColor="#a1a1aa"
            progressBackgroundColor="#17171a"
          />
        }
      >
        {/* Header --------------------------------------------------------- */}
        <View className="mb-5 flex-row items-center gap-3">
          <PlayerAvatar person={opponent} size="lg" highlight={false} />
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="text-[26px] leading-8 font-bold tracking-tight text-foreground"
            >
              {name}
            </Text>
            <Text numberOfLines={1} className="truncate text-sm text-muted">
              @{opponent.username}
              {h2h.last_played &&
                ` · last played ${matchDate(h2h.last_played)}`}
            </Text>
          </View>
        </View>

        {/* Head to head --------------------------------------------------- */}
        <View className="rounded-2xl border border-border bg-surface p-4">
          <View className="flex-row items-baseline justify-between">
            <Text className="min-w-0 flex-1 pr-2 text-sm font-semibold text-foreground">
              Head to head in {group.name}
            </Text>
            <Num className="shrink-0 text-sm text-muted">
              {`${h2h.played} ${h2h.played === 1 ? "match" : "matches"}`}
            </Num>
          </View>

          <View className="mt-4 flex-row items-center justify-between gap-2">
            <View className="flex-1 items-center">
              <Num className="text-3xl font-bold leading-8 text-win">
                {String(h2h.wins)}
              </Num>
              <Text className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                You
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Num className="text-3xl font-bold leading-8 text-draw">
                {String(h2h.draws)}
              </Num>
              <Text className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                Drawn
              </Text>
            </View>
            <View className="min-w-0 flex-1 items-center">
              <Num className="text-3xl font-bold leading-8 text-loss">
                {String(h2h.losses)}
              </Num>
              <Text
                numberOfLines={1}
                className="max-w-full mt-1 text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {name}
              </Text>
            </View>
          </View>

          <View className="mt-4">
            <ResultBar
              wins={h2h.wins}
              draws={h2h.draws}
              losses={h2h.losses}
            />
          </View>

          {decided > 0 && (
            <Text className="mt-3 text-center text-xs text-muted">
              {h2h.wins > h2h.losses
                ? `You lead this rivalry by ${h2h.wins - h2h.losses}.`
                : h2h.wins < h2h.losses
                  ? `${name} leads this rivalry by ${h2h.losses - h2h.wins}.`
                  : "Dead level."}
            </Text>
          )}
        </View>

        {/* Goals ------------------------------------------------------------ */}
        <View className="mt-4 flex-row gap-2">
          <StatTile
            label="Goals scored"
            value={h2h.goals_for}
            sub={`${decimal(h2h.avg_goals_for)} per match`}
            tone="win"
            className="flex-1"
          />
          <StatTile
            label="Conceded"
            value={h2h.goals_against}
            sub={`${decimal(h2h.avg_goals_against)} per match`}
            tone="loss"
            className="flex-1"
          />
        </View>

        {h2h.played > 0 && (
          <View className="mt-2 flex-row gap-2">
            <StatTile
              label="Goal diff"
              value={gd > 0 ? `+${gd}` : `${gd}`}
              tone={gd > 0 ? "win" : gd < 0 ? "loss" : "draw"}
              className="flex-1"
            />
            <StatTile
              label="Biggest win"
              value={
                h2h.biggest_win_margin > 0
                  ? `+${h2h.biggest_win_margin}`
                  : "—"
              }
              sub={
                h2h.biggest_win_margin > 0
                  ? "goal margin"
                  : "no wins yet"
              }
              className="flex-1"
            />
          </View>
        )}

        {/* Team-based head to head ------------------------------------------- */}
        {(teamStats.data ?? []).length > 0 && (
          <View className="mt-6 gap-3">
            <Text className="text-sm font-semibold text-foreground">
              Your teams v {name}
            </Text>
            <View className="rounded-xl border border-border">
              {(teamStats.data ?? []).map((row) => {
                const isBestPick = row.team_id === bestPickTeamId;

                return (
                  <View
                    key={row.team_id}
                    className={`flex-row items-center justify-between border-b border-border/60 px-3 py-2.5 last:border-b-0`}
                  >
                    <View className="flex-row min-w-0 flex-1 items-center gap-2 pr-2">
                      <TeamBadge team={{ name: row.team_name }} size="sm" />
                      <Text
                        numberOfLines={1}
                        className={`min-w-0 shrink text-[15px] font-medium ${
                          isBestPick ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {row.team_name}
                      </Text>
                      {isBestPick && (
                        <View className="ml-1 shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5">
                          <Text className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                            Best pick
                          </Text>
                        </View>
                      )}
                    </View>
                    <Num className="shrink-0 text-right text-sm text-muted">
                      {`${row.wins}-${row.draws}-${row.losses} · ${row.goals_for}-${row.goals_against}`}
                    </Num>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Rematch CTA -------------------------------------------------------- */}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push(`/match/new?group=${groupId}&opponent=${opponent.id}`)
          }
          className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80"
        >
          <Swords size={16} color="#fcfcfc" strokeWidth={2} />
          <Text className="text-[15px] font-semibold text-accent-foreground">
            Log a match v {name}
          </Text>
        </Pressable>

        {/* Meetings ------------------------------------------------------- */}
        <View className="mt-6 gap-3">
          <Text className="text-sm font-semibold text-foreground">
            Previous meetings
          </Text>

          {(matches.data ?? []).length === 0 ? (
            <EmptyState
              icon={Swords}
              title="You have never played"
              description={`Log a result against ${name} and the head-to-head starts here.`}
              action={{
                href: `/match/new?group=${groupId}&opponent=${opponent.id}`,
                label: "Log a match",
              }}
            />
          ) : (
            <View className="gap-2">
              {(matches.data ?? []).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  viewerId={userId}
                  showOpponentLink={false}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
