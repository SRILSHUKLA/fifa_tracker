import { useRouter } from "expo-router";
import { Crown, KeyRound, Plus, UsersRound } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { TabBody } from "@/components/screen";
import { useAuth } from "@/lib/auth";
import { useMyGroups } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

export default function GroupsScreen(): JSX.Element | null {
  const router = useRouter();
  const { session, profile } = useAuth();
  const groups = useMyGroups();

  if (!session?.user.id || !profile) return null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const list = groups.data ?? [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        profile={profile}
        onAvatarPress={() => router.push("/history")}
        onSignOut={handleSignOut}
      />
      <TabBody refreshing={groups.isFetching} onRefresh={groups.refetch}>
        <View className="mb-5">
          <Text className="text-[26px] leading-8 font-bold tracking-tight text-foreground">
            Groups
          </Text>
          <Text className="mt-0.5 text-sm leading-5 text-muted">
            You can only log matches, and see stats, against people who share
            a group with you.
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/groups/new")}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface active:opacity-60"
          >
            <Plus size={16} color="#fafafa" strokeWidth={2.25} />
            <Text className="text-[15px] font-medium text-foreground">
              Create
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/groups/join")}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface active:opacity-60"
          >
            <KeyRound size={16} color="#fafafa" strokeWidth={2} />
            <Text className="text-[15px] font-medium text-foreground">Join</Text>
          </Pressable>
        </View>

        <View className="mt-6 gap-3">
          <Text className="text-sm font-semibold text-foreground">
            {list.length > 0 ? `Your groups (${list.length})` : "Your groups"}
          </Text>

          {groups.isLoading ? null : list.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No groups yet"
              description="Create a group and share the invite code or link, or join one someone shared with you."
            />
          ) : (
            <View className="gap-2">
              {list.map(({ group, role }) => (
                <Pressable
                  key={group.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open group ${group.name}`}
                  onPress={() => router.push(`/groups/${group.id}`)}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3 active:opacity-60"
                >
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        numberOfLines={1}
                        className="min-w-0 shrink font-medium leading-tight text-foreground"
                      >
                        {group.name}
                      </Text>
                      {role === "owner" && (
                        <Crown size={13} color="#e2402f" strokeWidth={2} />
                      )}
                    </View>
                    <Text numberOfLines={1} className="text-xs text-muted">
                      {role === "owner" ? "You own this group" : "Member"}
                    </Text>
                  </View>
                  <Text className="shrink-0 text-lg text-muted">›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </TabBody>
    </View>
  );
}
