import { useRouter } from "expo-router";
import { Trophy } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { TabBody } from "@/components/screen";
import { LeagueList } from "@/components/league/league-list";
import { useAuth } from "@/lib/auth";
import {
  useLeagueCounts,
  useMyGroups,
  useMyLeagues,
  useOpenToJoinLeagues,
} from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

export default function LeaguesScreen(): JSX.Element | null {
  const router = useRouter();
  const { session, profile } = useAuth();
  const myGroups = useMyGroups();
  const myLeagues = useMyLeagues();
  const openToJoin = useOpenToJoinLeagues(true);

  const groups = myGroups.data ?? [];
  const myLeagueRows = (myLeagues.data ?? []).map((m) => m.league);
  const inProgress = myLeagueRows.filter((l) => l.status === "in_progress");
  const completed = myLeagueRows.filter((l) => l.status === "completed");
  // Draft leagues surface from every group the user is in, so there is a
  // path to discover and join one.
  const drafts = openToJoin.data ?? [];

  const counts = useLeagueCounts([
    ...new Set([...drafts, ...inProgress, ...completed].map((l) => l.id)),
  ]);

  if (!session?.user.id || !profile) return null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function refetchAll() {
    myGroups.refetch();
    myLeagues.refetch();
    openToJoin.refetch();
    counts.refetch();
  }

  const hasAnyLeague = drafts.length + inProgress.length + completed.length > 0;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        profile={profile}
        onAvatarPress={() => router.push("/history")}
        onSignOut={handleSignOut}
      />
      <TabBody
        refreshing={
          myGroups.isFetching || myLeagues.isFetching || openToJoin.isFetching
        }
        onRefresh={refetchAll}
      >
        <View className="mb-5">
          <Text className="text-[26px] leading-8 font-bold tracking-tight text-foreground">
            Leagues
          </Text>
          <Text className="mt-0.5 text-sm leading-5 text-muted">
            Round robins and knockouts across every group you’re in.
          </Text>
        </View>

        {groups.length > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/leagues/new")}
            className="h-12 w-full flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface active:opacity-60"
          >
            <Trophy size={16} color="#fafafa" strokeWidth={2} />
            <Text className="text-[15px] font-medium text-foreground">
              Start a league
            </Text>
          </Pressable>
        )}

        {!hasAnyLeague ? (
          <View className="mt-4">
            <EmptyState
              icon={Trophy}
              title="No leagues yet"
              description={
                groups.length > 0
                  ? "Start a round robin or knockout in one of your groups."
                  : "Leagues live inside a group. Create or join one first."
              }
              action={
                groups.length === 0
                  ? { href: "/groups", label: "Find a group" }
                  : undefined
              }
            />
          </View>
        ) : (
          <>
            {inProgress.length > 0 && (
              <View className="mt-6 gap-3">
                <Text className="text-sm font-semibold text-foreground">
                  In progress
                </Text>
                <LeagueList
                  leagues={inProgress}
                  participantCounts={counts.data ?? {}}
                />
              </View>
            )}

            {drafts.length > 0 && (
              <View className="mt-6 gap-3">
                <Text className="text-sm font-semibold text-foreground">
                  Open to join
                </Text>
                <LeagueList
                  leagues={drafts}
                  participantCounts={counts.data ?? {}}
                />
              </View>
            )}

            {completed.length > 0 && (
              <View className="mt-6 gap-3">
                <Text className="text-sm font-semibold text-foreground">
                  Completed
                </Text>
                <LeagueList
                  leagues={completed}
                  participantCounts={counts.data ?? {}}
                />
              </View>
            )}
          </>
        )}
      </TabBody>
    </View>
  );
}
