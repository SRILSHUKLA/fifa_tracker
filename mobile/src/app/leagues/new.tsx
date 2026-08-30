import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { DetailScreen } from "@/components/screen";
import { TeamPicker } from "@/components/pickers";
import { useActiveGroup } from "@/lib/active-group";
import { leagueTypeDescription, leagueTypeLabel } from "@/components/league/meta";
import {
  useCreateLeague,
  useMyGroups,
  useTeams,
} from "@/lib/hooks";
import type { LeagueType } from "@/types/database.types";

const KNOCKOUT_SIZES = [2, 4, 8, 16] as const;
const TYPES: LeagueType[] = [
  "single_round_robin",
  "double_round_robin",
  "round_robin_knockout",
];

/**
 * Creates a league. The creator also picks their own team and is seated as
 * the league's first participant the moment it's created (create_league()).
 */
export default function NewLeagueScreen(): JSX.Element | null {
  const router = useRouter();
  const params = useLocalSearchParams<{ group?: string }>();
  const { group: activeGroup } = useActiveGroup();
  const myGroups = useMyGroups();
  const teams = useTeams();

  const groups = myGroups.data ?? [];

  const [groupId, setGroupId] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);
  if (!initialised && groups.length > 0) {
    setInitialised(true);
    const requested =
      typeof params.group === "string" &&
      groups.some((g) => g.group.id === params.group)
        ? params.group
        : null;
    setGroupId(requested ?? activeGroup?.id ?? groups[0].group.id);
  }

  const [name, setName] = useState("");
  const [type, setType] = useState<LeagueType>("single_round_robin");
  const [knockoutSize, setKnockoutSize] = useState<number>(4);
  const [teamId, setTeamId] = useState<number | null>(null);

  const createLeague = useCreateLeague((league) =>
    router.replace(`/leagues/${league.id}`),
  );

  if (!groups.length && !myGroups.isLoading) return null;

  const selectedGroup = groups.find((g) => g.group.id === groupId)?.group ?? null;

  function handleSubmit() {
    if (!groupId || !teamId) return;

    createLeague.mutate({
      groupId,
      name,
      type,
      teamId,
      knockoutSize:
        type === "round_robin_knockout" ? knockoutSize : null,
    });
  }

  return (
    <DetailScreen
      title="Start a league"
      subtitle="Everyone joins by picking a team. Fixtures generate when you start it."
      backLabel="Leagues"
    >
      {groups.length > 1 && (
        <View className="mb-5 gap-2">
          <Text className="text-sm font-medium text-foreground">Group</Text>
          <View className="flex-row flex-wrap gap-2">
            {groups.map(({ group }) => {
              const isActive = group.id === groupId;
              return (
                <Pressable
                  key={group.id}
                  onPress={() => setGroupId(group.id)}
                  className={`rounded-full border px-3.5 py-1.5 ${
                    isActive ? "border-accent bg-accent/10" : "border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      isActive ? "text-accent" : "text-muted"
                    }`}
                  >
                    {group.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">League name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={selectedGroup ? `${selectedGroup.name} League` : "Sunday League"}
          maxLength={40}
          autoFocus
          className="h-12 rounded-xl border border-border bg-surface px-3 text-[15px] text-foreground"
          placeholderTextColor="#71717a"
        />
      </View>

      <View className="mt-5 gap-2">
        <Text className="text-sm font-medium text-foreground">Format</Text>
        {TYPES.map((option) => {
          const isActive = type === option;
          return (
            <Pressable
              key={option}
              onPress={() => setType(option)}
              className={`w-full rounded-xl border p-3 ${
                isActive ? "border-accent bg-accent/5" : "border-border"
              }`}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  className={`flex-1 text-[15px] font-medium ${
                    isActive ? "text-accent" : "text-foreground"
                  }`}
                >
                  {leagueTypeLabel(option)}
                </Text>
                {isActive && (
                  <Text className="shrink-0 text-xs font-semibold text-accent">✓</Text>
                )}
              </View>
              <Text className="mt-0.5 text-xs leading-4 text-muted">
                {leagueTypeDescription(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {type === "round_robin_knockout" && (
        <View className="mt-5 gap-2">
          <Text className="text-sm font-medium text-foreground">
            Players who advance to the knockout stage
          </Text>
          <View className="flex-row gap-2">
            {KNOCKOUT_SIZES.map((size) => {
              const isActive = knockoutSize === size;
              return (
                <Pressable
                  key={size}
                  onPress={() => setKnockoutSize(size)}
                  className={`h-11 flex-1 items-center justify-center rounded-xl border ${
                    isActive ? "border-accent bg-accent/10" : "border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      isActive ? "text-accent" : "text-muted"
                    }`}
                  >
                    Top {size}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-xs text-muted">
            The league needs at least this many players joined before it can
            start.
          </Text>
        </View>
      )}

      <View className="mt-5 gap-2">
        <Text className="text-sm font-medium text-foreground">Your team</Text>
        <TeamPicker
          teams={teams.data ?? []}
          value={teamId}
          onChange={setTeamId}
          label="Your team"
        />
        <Text className="text-xs text-muted">
          This is the team you’ll play as for every match in this league.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create league"
        disabled={
          createLeague.isPending || !groupId || !teamId || name.trim().length < 2
        }
        onPress={handleSubmit}
        className={`mt-8 h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
          createLeague.isPending || !teamId || name.trim().length < 2
            ? "opacity-50"
            : ""
        }`}
      >
        <Text className="text-base font-semibold text-accent-foreground">
          {createLeague.isPending ? "Creating…" : "Create league"}
        </Text>
      </Pressable>
    </DetailScreen>
  );
}
