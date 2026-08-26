import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarClock,
  Trophy,
  UsersRound,
  X,
} from "lucide-react-native";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { OpponentPicker, TeamPicker } from "@/components/pickers";
import { ScoreStepper } from "@/components/score-stepper";
import { useActiveGroup } from "@/lib/active-group";
import { useAuth } from "@/lib/auth";
import {
  useGroupMembers,
  useLogMatch,
  useMyGroups,
  useTeams,
} from "@/lib/hooks";
import { displayName } from "@/lib/format";
import { toast } from "@/lib/toast";

/**
 * The log-a-match flow, presented modally. Deep-linkable via
 * /match/new?group=<id>&opponent=<id> — group and H2H pages link straight
 * into a rematch with both preselected.
 */
export default function NewMatchScreen(): JSX.Element | null {
  const router = useRouter();
  const params = useLocalSearchParams<{ group?: string; opponent?: string }>();
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const userId = session?.user.id;
  const { group: activeGroup } = useActiveGroup();
  const myGroups = useMyGroups();
  const teams = useTeams();

  // Preselect the deep-linked group if valid, else the active one, else the
  // first available — resolved once when the groups load in.
  const [groupId, setGroupId] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);
  const groups = myGroups.data ?? [];

  if (!initialised && groups.length > 0) {
    setInitialised(true);
    const requested =
      typeof params.group === "string" &&
      groups.some((g) => g.group.id === params.group)
        ? params.group
        : null;
    setGroupId(requested ?? activeGroup?.id ?? groups[0].group.id);
  }

  const members = useGroupMembers(groupId ?? "");
  const logMatch = useLogMatch(() => router.dismiss());

  const roster = useMemo(
    () => (members.data ?? []).filter((member) => member.id !== userId),
    [members.data, userId],
  );

  const [opponentId, setOpponentId] = useState<string | null>(
    typeof params.opponent === "string" ? params.opponent : null,
  );
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<number | null>(null);
  const [backdating, setBackdating] = useState(false);
  const [playedAt, setPlayedAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const opponent =
    (members.data ?? []).find((member) => member.id === opponentId) ?? null;
  const opponentName = opponent ? displayName(opponent) : "Opponent";

  // Shown live from the score; the stored winner comes from the database's
  // generated column — the UI never decides the result.
  const outcome =
    myScore > opponentScore
      ? { label: "You win", tone: "text-win" }
      : myScore < opponentScore
        ? { label: `${opponentName} wins`, tone: "text-loss" }
        : { label: "Draw", tone: "text-muted" };

  if (!userId) return null;

  function handleGroupChange(nextGroupId: string) {
    setGroupId(nextGroupId);
    // A different group means a different roster — drop any stale pick.
    setOpponentId(null);
  }

  function handleSave() {
    if (!groupId || !opponentId) return;

    logMatch.mutate(
      {
        groupId,
        opponentId,
        myScore,
        opponentScore,
        myTeamId,
        opponentTeamId,
        playedAt: backdating ? playedAt.toISOString() : new Date().toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(
            `${myScore}–${opponentScore} v ${opponentName} logged`,
          );
        },
      },
    );
  }

  if (groups.length === 0 && !myGroups.isLoading) {
    return (
      <View
        className="flex-1 bg-background px-4"
        style={{ paddingTop: insets.top + 8 }}
      >
        <ModalClose />
        <View className="mb-5 mt-4">
          <Text className="text-[26px] font-bold tracking-tight text-foreground">
            Log a match
          </Text>
          <Text className="mt-0.5 text-sm text-muted">
            The winner is worked out from the score.
          </Text>
        </View>
        <EmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Matches are logged within a group. Create or join one first."
          action={{ href: "/groups", label: "Find a group" }}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center justify-between border-b border-border/60 px-2">
        <ModalClose />
        <Text className="flex-1 text-center text-[15px] font-semibold text-foreground">
          Log a match
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
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
                    onPress={() => handleGroupChange(group.id)}
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

        <View className="mb-5 gap-2">
          <Text className="text-sm font-medium text-foreground">Opponent</Text>
          <OpponentPicker
            members={roster}
            value={opponentId}
            onChange={setOpponentId}
          />
        </View>

        <View className="rounded-xl border border-border bg-surface p-4">
          <View className="flex-row items-start justify-center gap-3">
            <ScoreStepper
              label="You"
              value={myScore}
              onChange={setMyScore}
              highlight={myScore > opponentScore}
            />
            <Text className="pt-9 text-xl font-semibold text-muted">–</Text>
            <ScoreStepper
              label={opponentName}
              value={opponentScore}
              onChange={setOpponentScore}
              highlight={opponentScore > myScore}
            />
          </View>

          <View className="mt-4 flex-row items-center justify-center gap-1.5">
            <Trophy size={15} color="#a1a1aa" strokeWidth={2} />
            <Text className={`text-sm font-semibold ${outcome.tone}`}>
              {outcome.label}
            </Text>
          </View>
        </View>

        <View className="mt-5 gap-2">
          <Text className="text-sm font-medium text-foreground">Your team</Text>
          <TeamPicker
            teams={teams.data ?? []}
            value={myTeamId}
            onChange={setMyTeamId}
            label="Your team"
            clearable
          />
        </View>

        <View className="mt-4 gap-2">
          <Text className="text-sm font-medium text-foreground">
            {`${opponentName}’s team`}
          </Text>
          <TeamPicker
            teams={teams.data ?? []}
            value={opponentTeamId}
            onChange={setOpponentTeamId}
            label="Their team"
            clearable
          />
        </View>

        {/* Backdating is opt-in so the common case — logging right after the
            final whistle — stays a two-tap flow. */}
        {!backdating ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setBackdating(true)}
            className="mt-5 self-start rounded-lg py-1 active:opacity-60"
          >
            <View className="flex-row items-center gap-1.5">
              <CalendarClock size={15} color="#a1a1aa" strokeWidth={2} />
              <Text className="text-sm text-muted">
                Played earlier? Set a date
              </Text>
            </View>
          </Pressable>
        ) : (
          <View className="mt-5 gap-2">
            <Text className="text-sm font-medium text-foreground">
              Played at
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDatePicker(true)}
              className="h-11 justify-center rounded-xl border border-border bg-surface px-3 active:opacity-60"
            >
              <Text className="text-[15px] text-foreground">
                {playedAt.toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={playedAt}
                mode="datetime"
                maximumDate={new Date()}
                themeVariant="dark"
                display={Platform.OS === "ios" ? "compact" : "default"}
                onChange={(_event, date) => {
                  setShowDatePicker(Platform.OS === "android");
                  if (date) setPlayedAt(date);
                }}
              />
            )}
          </View>
        )}

        <Button
          className="mt-8 h-12"
          isDisabled={
            logMatch.isPending || !groupId || !opponentId || members.isLoading
          }
          onPress={handleSave}
        >
          {logMatch.isPending ? "Saving…" : "Save match"}
        </Button>
      </ScrollView>
    </View>
  );
}

function ModalClose() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={() => router.dismiss()}
      hitSlop={8}
      className="rounded-lg p-2 active:opacity-60"
    >
      <X size={20} color="#a1a1aa" strokeWidth={2.25} />
    </Pressable>
  );
}
