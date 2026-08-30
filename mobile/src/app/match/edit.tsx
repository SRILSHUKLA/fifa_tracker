import { useLocalSearchParams, useRouter } from "expo-router";
import { Trophy, X } from "lucide-react-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TeamPicker } from "@/components/pickers";
import { ScoreStepper } from "@/components/score-stepper";
import { useAuth } from "@/lib/auth";
import { fromPerspective } from "@/lib/queries/matches";
import { useEditMatch, useMatch, useTeams } from "@/lib/hooks";
import { displayName } from "@/lib/format";
import type { MatchWithPlayers } from "@/lib/queries/matches";

/**
 * Corrects an already-logged match's score or teams. Either participant may
 * edit; the UI is framed as "You" v the opponent and mapped back to the
 * match's absolute player_one/player_two before submitting. A penalty
 * picker appears only for a drawn knockout-stage league fixture.
 */
export default function EditMatchScreen(): JSX.Element | null {
  const params = useLocalSearchParams<{ matchId?: string }>();
  const insets = useSafeAreaInsets();
  const matchId = typeof params.matchId === "string" ? params.matchId : "";

  const { session } = useAuth();
  const userId = session?.user.id;
  const matchQuery = useMatch(matchId);
  const match = matchQuery.data ?? null;

  if (!userId) return null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center justify-between border-b border-border/60 px-2">
        <CloseButton />
        <Text className="flex-1 text-center text-[15px] font-semibold text-foreground">
          Edit result
        </Text>
        <View className="w-10" />
      </View>

      {!match ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted">
            {matchQuery.isLoading ? "Loading…" : "Match not found."}
          </Text>
        </View>
      ) : (
        <EditMatchForm key={match.id} match={match} viewerId={userId} />
      )}
    </View>
  );
}

function CloseButton() {
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

function EditMatchForm({
  match,
  viewerId,
}: {
  match: MatchWithPlayers;
  viewerId: string;
}) {
  const router = useRouter();
  const p = fromPerspective(match, viewerId);
  const opponentName = displayName(p.them);

  const [myScore, setMyScore] = useState(p.myScore);
  const [opponentScore, setOpponentScore] = useState(p.theirScore);
  const [myTeamId, setMyTeamId] = useState<number | null>(p.myTeam?.id ?? null);
  const [opponentTeamId, setOpponentTeamId] = useState<number | null>(
    p.theirTeam?.id ?? null,
  );
  const [penaltyWinner, setPenaltyWinner] = useState<"me" | "them" | null>(null);

  const teams = useTeams();
  const editMatch = useEditMatch(() => router.dismiss());

  const isPlayerOne = match.player_one.id === viewerId;

  const needsPenalties =
    match.leagueFixtureStage === "knockout" && myScore === opponentScore;

  function handleSave() {
    if (needsPenalties && !penaltyWinner) return;

    editMatch.mutate({
      matchId: match.id,
      playerOneScore: isPlayerOne ? myScore : opponentScore,
      playerTwoScore: isPlayerOne ? opponentScore : myScore,
      playerOneTeamId: isPlayerOne ? myTeamId : opponentTeamId,
      playerTwoTeamId: isPlayerOne ? opponentTeamId : myTeamId,
      playedAt: match.played_at,
      notes: match.notes,
      penaltyWinnerId: needsPenalties
        ? penaltyWinner === "them"
          ? p.them.id
          : viewerId
        : null,
    });
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-10 pt-5">
      <Text className="mb-4 text-sm text-muted">You v {opponentName}</Text>

      <View className="rounded-xl border border-border bg-surface p-4">
        <View className="flex-row items-start justify-center gap-3">
          <ScoreStepper
            label="You"
            value={myScore}
            onChange={setMyScore}
            highlight={myScore > opponentScore}
            compact
          />
          <Text className="pt-8 text-lg font-semibold text-muted">–</Text>
          <ScoreStepper
            label={opponentName}
            value={opponentScore}
            onChange={setOpponentScore}
            highlight={opponentScore > myScore}
            compact
          />
        </View>

        {needsPenalties && (
          <View className="mt-4 gap-2 rounded-lg border border-border bg-surface-secondary p-3">
            <View className="flex-row items-center gap-1.5">
              <Trophy size={15} color="#e2402f" strokeWidth={2} />
              <Text className="min-w-0 flex-1 text-sm font-medium text-foreground">
                Level — who won on penalties?
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Button
                variant={penaltyWinner === "me" ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onPress={() => setPenaltyWinner("me")}
              >
                You
              </Button>
              <Button
                variant={penaltyWinner === "them" ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onPress={() => setPenaltyWinner("them")}
              >
                {opponentName}
              </Button>
            </View>
          </View>
        )}
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
        <Text className="text-sm font-medium text-foreground">Their team</Text>
        <TeamPicker
          teams={teams.data ?? []}
          value={opponentTeamId}
          onChange={setOpponentTeamId}
          label="Their team"
          clearable
        />
      </View>

      <Button
        className="mt-8 h-12"
        isDisabled={editMatch.isPending || (needsPenalties && !penaltyWinner)}
        onPress={handleSave}
      >
        {editMatch.isPending ? "Saving…" : "Save changes"}
      </Button>
    </ScrollView>
  );
}
