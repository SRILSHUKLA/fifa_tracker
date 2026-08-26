import { useRouter } from "expo-router";
import { Trophy, UsersRound } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PlayerAvatar } from "@/components/player-avatar";
import { TabBody } from "@/components/screen";
import { ScopedHeader } from "@/components/group-switcher";
import { useAuth } from "@/lib/auth";
import { useActiveGroup } from "@/lib/active-group";
import { useLeaderboard } from "@/lib/hooks";
import { displayName } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function LeaderboardScreen(): JSX.Element | null {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { group } = useActiveGroup();
  const userId = session?.user.id;

  const leaderboard = useLeaderboard(group?.id ?? "");

  if (!userId || !profile) return null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!group) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          profile={profile}
          onAvatarPress={() => router.push("/history")}
          onSignOut={handleSignOut}
        />
        <TabBody>
          <View className="mb-5">
            <Text className="text-[26px] font-bold tracking-tight text-foreground">
              Leaderboard
            </Text>
          </View>
          <EmptyState
            icon={UsersRound}
            title="No group yet"
            description="The table is scoped to a group. Create or join one to see who's winning."
            action={{ href: "/groups", label: "Find a group" }}
          />
        </TabBody>
      </View>
    );
  }

  const rows = leaderboard.data ?? [];
  const ranked = rows.filter((row) => row.played > 0);
  const unranked = rows.filter((row) => row.played === 0);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        profile={profile}
        onAvatarPress={() => router.push("/history")}
        onSignOut={handleSignOut}
      />
      <TabBody refreshing={leaderboard.isFetching} onRefresh={leaderboard.refetch}>
        <ScopedHeader
          title="Leaderboard"
          subtitle={`${group.name} · 3 points a win, 1 a draw. Ties split on goal difference.`}
        />

        {ranked.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nothing to rank yet"
            description="The table fills up as soon as the first match is logged."
            action={{ href: `/match/new?group=${group.id}`, label: "Log a match" }}
          />
        ) : (
          <LeaderboardTable
            rows={ranked}
            viewerId={userId}
            groupId={group.id}
          />
        )}

        {unranked.length > 0 && (
          <View className="mt-5 gap-2">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted">
              Yet to play
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {unranked.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${displayName(row)}, yet to play`}
                  onPress={() =>
                    router.push(
                      row.id === userId
                        ? "/history"
                        : `/groups/${group.id}/members/${row.username}`,
                    )
                  }
                  className="flex-row items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 active:opacity-60"
                >
                  <PlayerAvatar person={row} size="sm" highlight={row.id === userId} />
                  <Text numberOfLines={1} className="max-w-[120px] text-sm text-foreground">
                    {displayName(row)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </TabBody>
    </View>
  );
}
