"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarClock, LoaderCircle, Trophy } from "lucide-react";
import { toast } from "sonner";

import { logMatch } from "@/app/(app)/match/new/actions";
import { OpponentPicker } from "@/components/match/opponent-picker";
import { ScoreStepper } from "@/components/match/score-stepper";
import { TeamCombobox } from "@/components/match/team-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName } from "@/lib/format";
import type { FriendSummary, Profile, Team } from "@/types/database.types";

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in the browser's own timezone. */
function toLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function AddMatchForm({
  me,
  friends,
  teams,
  defaultOpponentId,
}: {
  me: Profile;
  friends: FriendSummary[];
  teams: Team[];
  defaultOpponentId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [opponentId, setOpponentId] = useState<string | null>(
    defaultOpponentId && friends.some((f) => f.id === defaultOpponentId)
      ? defaultOpponentId
      : null,
  );
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<number | null>(null);

  const [backdating, setBackdating] = useState(false);
  const [playedAt, setPlayedAt] = useState(() => toLocalInputValue(new Date()));

  const opponent = useMemo(
    () => friends.find((friend) => friend.id === opponentId) ?? null,
    [friends, opponentId],
  );

  const opponentName = opponent ? displayName(opponent) : "Opponent";

  // Shown live from the score, but the stored winner comes from the database's
  // generated column — the UI never decides the result.
  const outcome =
    myScore > opponentScore
      ? { label: "You win", tone: "text-win" }
      : myScore < opponentScore
        ? { label: `${opponentName} wins`, tone: "text-loss" }
        : { label: "Draw", tone: "text-muted-foreground" };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!opponentId) {
      toast.error("Choose an opponent first.");
      return;
    }

    startTransition(async () => {
      const result = await logMatch({
        opponentId,
        myScore,
        opponentScore,
        myTeamId,
        opponentTeamId,
        playedAt: backdating
          ? new Date(playedAt).toISOString()
          : new Date().toISOString(),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `${myScore}–${opponentScore} v ${opponentName} logged.`,
      );
      router.push("/");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>Opponent</Label>
        <OpponentPicker
          friends={friends}
          value={opponentId}
          onChange={setOpponentId}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-center gap-3">
          <ScoreStepper
            label="You"
            value={myScore}
            onChange={setMyScore}
            highlight={myScore > opponentScore}
          />
          <span className="pt-9 text-xl font-semibold text-muted-foreground">
            –
          </span>
          <ScoreStepper
            label={opponentName}
            value={opponentScore}
            onChange={setOpponentScore}
            highlight={opponentScore > myScore}
          />
        </div>

        <p
          className={`mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold ${outcome.tone}`}
        >
          <Trophy className="size-4" />
          {outcome.label}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-2">
          <Label>{displayName(me)}&apos;s team</Label>
          <TeamCombobox
            teams={teams}
            value={myTeamId}
            onChange={setMyTeamId}
            label="Your team"
          />
        </div>

        <div className="space-y-2">
          <Label>{opponentName}&apos;s team</Label>
          <TeamCombobox
            teams={teams}
            value={opponentTeamId}
            onChange={setOpponentTeamId}
            label="Opponent team"
          />
        </div>
      </div>

      {/* Backdating is opt-in so the common case — logging right after the
          final whistle — stays a two-tap flow. */}
      <div className="space-y-2">
        {backdating ? (
          <>
            <Label htmlFor="played-at">Played at</Label>
            <Input
              id="played-at"
              type="datetime-local"
              value={playedAt}
              max={toLocalInputValue(new Date())}
              onChange={(event) => setPlayedAt(event.target.value)}
              className="h-11"
            />
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setBackdating(true)}
            className="text-muted-foreground"
          >
            <CalendarClock className="size-4" />
            Played earlier? Set a date
          </Button>
        )}
      </div>

      <Button
        type="submit"
        disabled={pending || !opponentId}
        className="h-13 w-full text-base"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Save match
      </Button>
    </form>
  );
}
