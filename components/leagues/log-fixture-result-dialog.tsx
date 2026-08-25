"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trophy } from "lucide-react";
import { toast } from "sonner";

import { logLeagueFixtureAction } from "@/app/(app)/leagues/actions";
import { ScoreStepper } from "@/components/match/score-stepper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayName } from "@/lib/format";
import type { LeagueFixtureWithPlayers } from "@/lib/queries/leagues";

/**
 * Logs one fixture's result. A penalty-shootout picker appears only when
 * this is a knockout-stage fixture and the live scores are level — a
 * round-robin draw needs no such resolution. See the penalty-shootout rule
 * in log_league_fixture_result (0005_leagues.sql).
 */
export function LogFixtureResultDialog({
  fixture,
  leagueId,
  viewerId,
  open,
  onOpenChange,
}: {
  fixture: LeagueFixtureWithPlayers;
  leagueId: string;
  viewerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [penaltyWinner, setPenaltyWinner] = useState<"me" | "opponent" | null>(null);

  if (!fixture.player_one || !fixture.player_two) return null;

  const isPlayerOne = fixture.player_one.id === viewerId;
  const me = isPlayerOne ? fixture.player_one : fixture.player_two;
  const opponent = isPlayerOne ? fixture.player_two : fixture.player_one;
  const opponentName = displayName(opponent);

  const needsPenalties = fixture.stage === "knockout" && myScore === opponentScore;

  function handleSubmit() {
    if (needsPenalties && !penaltyWinner) {
      toast.error("This was a draw — pick who won on penalties.");
      return;
    }

    startTransition(async () => {
      const result = await logLeagueFixtureAction(
        leagueId,
        fixture.id,
        myScore,
        opponentScore,
        needsPenalties ? (penaltyWinner === "me" ? me!.id : opponent!.id) : null,
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      toast.success(
        result.leagueStatus === "completed"
          ? result.championId === viewerId
            ? "Result saved — you're the champion! 🏆"
            : "Result saved — the league is complete."
          : `${myScore}–${opponentScore} v ${opponentName} logged.`,
      );
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-xl"
        // Radix focuses (and ScoreStepper's onFocus then selects) the first
        // focusable element on open by default — with both scores starting
        // at 0 the "−" buttons start disabled, so that would be the "You"
        // score input, showing up pre-selected the instant the dialog
        // opens. Nothing needs focus stolen here, so skip the auto-focus.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>You v {opponentName}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start justify-center gap-2">
          <ScoreStepper
            label="You"
            value={myScore}
            onChange={setMyScore}
            highlight={myScore > opponentScore}
            size="compact"
          />
          <span className="pt-8 text-lg font-semibold text-muted-foreground">–</span>
          <ScoreStepper
            label={opponentName}
            value={opponentScore}
            onChange={setOpponentScore}
            highlight={opponentScore > myScore}
            size="compact"
          />
        </div>

        {needsPenalties && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Trophy className="size-4 text-primary" />
              Level — who won on penalties?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={penaltyWinner === "me" ? "default" : "outline"}
                onClick={() => setPenaltyWinner("me")}
              >
                You
              </Button>
              <Button
                type="button"
                variant={penaltyWinner === "opponent" ? "default" : "outline"}
                onClick={() => setPenaltyWinner("opponent")}
              >
                {opponentName}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="sm:gap-2">
          <Button onClick={handleSubmit} disabled={pending} className="w-full">
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Save result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
