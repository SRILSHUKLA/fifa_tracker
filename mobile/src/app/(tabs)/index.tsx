import { useRouter } from "expo-router";
import { ChevronRight, Swords, UsersRound } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MatchCard } from "@/components/match-card";
import { TabBody } from "@/components/screen";
import { ScopedHeader } from "@/components/group-switcher";
import { StatTile, RecordCard } from "@/components/stat-tile";
import { useAuth } from "@/lib/auth";
import { useActiveGroup } from "@/lib/active-group";
import {
  useLeaderboard,
  useMatches,
  useRecentForm,
} from "@/lib/hooks";
import { displayName, decimal, signed } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function HomeScreen(): JSX.Element | null {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { group, isLoading: groupLoading } = useActiveGroup();
  const userId = session?.user.id;

  const leaderboard = useLeaderboard(group?.id ?? "");
  const form = useRecentForm(userId, group?.id);
  const matches = useMatches({
    groupId: group?.id,
    playerId: userId,
    limit: 5,
  });

  if (!userId || !profile) return null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Onboarding: no group yet.
  if (!group) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          profile={profile}
          onAvatarPress={() => router.push("/history")}
          onSignOut={handleSignOut}
        />
        <TabBody>
          <View className="mb-6">
            <Text className="text-sm text-muted">Welcome</Text>
            <Text className="text-[26px] font-bold tracking-tight text-foreground">
              {displayName(profile)}
            </Text>
          </View>

          <EmptyState
            icon={UsersRound}
            title="Get your group set up"
            description="Create a group and share the invite code with your friends, or join a group someone shared with you, to start tracking matches."
            action={{ href: "/groups", label: "Create or join a group" }}
          />
        </TabBody>
      </View>
    );
  }

  const stats = (leaderboard.data ?? []).find((row) => row.id === userId) ?? null;
  const played = stats?.played ?? 0;
  const goalsFor = stats?.goals_for ?? 0;
  const gd = stats?.goal_difference ?? 0;

  const refreshing =
    leaderboard.isFetching || form.isFetching || matches.isFetching;

  function refetchAll() {
    leaderboard.refetch();
    form.refetch();
    matches.refetch();
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        profile={profile}
        onAvatarPress={() => router.push("/history")}
        onSignOut={handleSignOut}
      />
      <TabBody refreshing={refreshing} onRefresh={refetchAll}>
        <ScopedHeader
          title={displayName(profile)}
          subtitle={`Welcome back · ${group.name}`}
        />

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
          <StatTile label="Scored" value={goalsFor} className="flex-1" />
          <StatTile
            label="Conceded"
            value={stats?.goals_against ?? 0}
            className="flex-1"
          />
          <StatTile
            label="Goal diff"
            value={signed(gd)}
            tone={gd > 0 ? "win" : gd < 0 ? "loss" : "draw"}
            className="flex-1"
          />
        </View>

        {played > 0 && (
          <Text className="mt-3 text-center text-xs text-muted">
            {decimal(goalsFor / played)} goals scored per match ·{" "}
            {decimal(stats?.win_pct)}% win rate
          </Text>
        )}

        <View className="mt-6 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">
              Recent matches
            </Text>
            {(matches.data?.length ?? 0) > 0 && (
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/history")}
                className="flex-row items-center active:opacity-60"
              >
                <Text className="text-sm font-medium text-accent">See all</Text>
                <ChevronRight size={15} color="#e2402f" strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {(matches.data?.length ?? 0) === 0 && !matches.isLoading ? (
            <EmptyState
              icon={Swords}
              title="No matches yet"
              description="Log your first result and your stats will start filling in."
              action={{ href: `/match/new?group=${group.id}`, label: "Log a match" }}
            />
          ) : (
            <View className="gap-2">
              {(matches.data ?? []).map((match) => (
                <MatchCard key={match.id} match={match} viewerId={userId} />
              ))}
            </View>
          )}
        </View>

        {!groupLoading && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/groups/${group.id}`)}
            className="mt-4 flex-row items-center justify-center gap-1 py-2 active:opacity-60"
          >
            <Text className="text-sm font-medium text-muted">
              View {group.name}
            </Text>
            <ChevronRight size={15} color="#a1a1aa" strokeWidth={2} />
          </Pressable>
        )}
      </TabBody>
    </View>
  );
}
