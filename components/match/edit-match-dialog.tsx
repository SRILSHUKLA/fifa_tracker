"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Trophy } from "lucide-react";
import { toast } from "sonner";

import { editMatchAction } from "@/app/(app)/match/new/actions";
import { ScoreStepper } from "@/components/match/score-stepper";
import { TeamCombobox } from "@/components/match/team-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName } from "@/lib/format";
import { fromPerspective, type MatchWithPlayers } from "@/lib/queries/matches";
import type { Team } from "@/types/database.types";

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in the browser's own timezone. */
function toLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Corrects an already-logged match's score, teams, or date — for accidental
 * typos ("meant to log 1-3, logged 3-1"). Only ever rendered for a match the
 * viewer logged themselves (see components/match/match-card.tsx's `action`
 * usage on the history page), and the logger is always stored as
 * player_one, so "me"/"You" here always maps straight onto player_one with
 * no perspective juggling.
 *
 * A penalty-shootout picker appears only if this is a knockout-stage league
 * fixture and the live scores are level — see the same rule in
 * components/leagues/log-fixture-result-dialog.tsx and edit_match in
 * 0006_edit_match.sql.
 */
export function EditMatchDialog({
  match,
  viewerId,
  teams,
  open,
  onOpenChange,
}: {
  match: MatchWithPlayers;
  viewerId: string;
  teams: Team[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { them } = fromPerspective(match, viewerId);
  const opponentName = displayName(them);

  const [myScore, setMyScore] = useState(match.player_one_score);
  const [opponentScore, setOpponentScore] = useState(match.player_two_score);
  const [myTeamId, setMyTeamId] = useState<number | null>(match.team_one?.id ?? null);
  const [opponentTeamId, setOpponentTeamId] = useState<number | null>(
    match.team_two?.id ?? null,
  );
  const [playedAt, setPlayedAt] = useState(() => toLocalInputValue(new Date(match.played_at)));
  const [penaltyWinner, setPenaltyWinner] = useState<"me" | "opponent" | null>(null);

  const needsPenalties = match.leagueFixtureStage === "knockout" && myScore === opponentScore;

  function handleSubmit() {
    if (needsPenalties && !penaltyWinner) {
      toast.error("This was a draw — pick who won on penalties.");
      return;
    }

    startTransition(async () => {
      const result = await editMatchAction({
        matchId: match.id,
        myScore,
        opponentScore,
        myTeamId,
        opponentTeamId,
        playedAt: new Date(playedAt).toISOString(),
        notes: match.notes,
        penaltyWinnerId: needsPenalties ? (penaltyWinner === "me" ? viewerId : them.id) : null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      toast.success(`${myScore}–${opponentScore} v ${opponentName} updated.`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit result: You v {opponentName}</DialogTitle>
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

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label>Your team</Label>
            <TeamCombobox teams={teams} value={myTeamId} onChange={setMyTeamId} label="Your team" />
          </div>
          <div className="space-y-1.5">
            <Label>{opponentName}&apos;s team</Label>
            <TeamCombobox
              teams={teams}
              value={opponentTeamId}
              onChange={setOpponentTeamId}
              label="Opponent team"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-played-at">Played at</Label>
          <Input
            id="edit-played-at"
            type="datetime-local"
            value={playedAt}
            max={toLocalInputValue(new Date())}
            onChange={(event) => setPlayedAt(event.target.value)}
            className="h-11"
          />
        </div>

        <DialogFooter className="sm:gap-2">
          <Button onClick={handleSubmit} disabled={pending} className="w-full">
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The pencil button that opens EditMatchDialog — passed as MatchCard's
 * `action` prop from the history page, for matches the viewer logged
 * themselves.
 */
export function EditMatchButton({
  match,
  viewerId,
  teams,
}: {
  match: MatchWithPlayers;
  viewerId: string;
  teams: Team[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Edit this result"
        onClick={() => setOpen(true)}
        className="shrink-0 self-center text-muted-foreground"
      >
        <Pencil className="size-4" />
      </Button>
      <EditMatchDialog match={match} viewerId={viewerId} teams={teams} open={open} onOpenChange={setOpen} />
    </>
  );
}
