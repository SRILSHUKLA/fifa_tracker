import { BottomSheet, Button } from "heroui-native";
import { Trophy } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { ScoreStepper } from "../score-stepper";
import { displayName } from "@/lib/format";
import type { LeagueFixtureWithPlayers } from "@/lib/queries/leagues";
import { toast } from "@/lib/toast";
import { useLogFixtureResult } from "@/lib/hooks";

/**
 * Logs one fixture's result. A penalty-shootout picker appears only when
 * this is a knockout-stage fixture and the live scores are level — a
 * round-robin draw needs no such resolution.
 */
export function LogFixtureSheet({
  fixture,
  leagueId,
  viewerId,
  isOpen,
  onOpenChange,
}: {
  fixture: LeagueFixtureWithPlayers;
  leagueId: string;
  viewerId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [penaltyWinner, setPenaltyWinner] = useState<"me" | "them" | null>(null);

  const logResult = useLogFixtureResult(leagueId, viewerId);

  if (!fixture.player_one || !fixture.player_two) return null;

  const isPlayerOne = fixture.player_one.id === viewerId;
  const me = isPlayerOne ? fixture.player_one : fixture.player_two;
  const opponent = isPlayerOne ? fixture.player_two : fixture.player_one;
  const opponentName = displayName(opponent);

  const needsPenalties =
    fixture.stage === "knockout" && myScore === opponentScore;

  function handleSubmit() {
    if (needsPenalties && !penaltyWinner) {
      toast.error("Pick who won on penalties", "This was a draw.");
      return;
    }

    logResult.mutate(
      {
        fixtureId: fixture.id,
        myScore,
        opponentScore,
        penaltyWinnerId: needsPenalties
          ? penaltyWinner === "me"
            ? me.id
            : opponent.id
          : null,
      },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          if (result.league_status !== "completed") {
            toast.success(`${myScore}–${opponentScore} v ${opponentName} logged`);
          }
        },
      },
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Content snapPoints={["62%"]} enablePanDownToClose>
          <View className="flex-1 px-4 pb-8 pt-1">
            <Text className="text-base font-semibold text-foreground">
              You v {opponentName}
            </Text>

            <View className="mt-4 flex-row items-start justify-center gap-2">
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
                  <Text className="flex-1 text-sm font-medium text-foreground">
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

            <Button
              className="mt-auto h-12"
              isDisabled={logResult.isPending}
              onPress={handleSubmit}
            >
              {logResult.isPending ? "Saving…" : "Save result"}
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
