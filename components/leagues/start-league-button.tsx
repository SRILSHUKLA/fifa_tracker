"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";

import { startLeagueAction } from "@/app/(app)/leagues/actions";
import { Button } from "@/components/ui/button";

/**
 * Creator-only. Once tapped, the roster locks and every round-robin fixture
 * is generated instantly (start_league() in 0005_leagues.sql) — no more
 * joining after this.
 */
export function StartLeagueButton({
  leagueId,
  participantCount,
  minParticipants,
}: {
  leagueId: string;
  participantCount: number;
  minParticipants: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canStart = participantCount >= minParticipants;

  function handleStart() {
    startTransition(async () => {
      const result = await startLeagueAction(leagueId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("League started — fixtures are up.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">
        {participantCount} {participantCount === 1 ? "player has" : "players have"} joined
      </p>
      {!canStart && (
        <p className="text-xs text-muted-foreground">
          Need at least {minParticipants} to start.
        </p>
      )}
      <Button onClick={handleStart} disabled={pending || !canStart} className="h-11 w-full">
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        <Play className="size-4" />
        Start league — no more joining after this
      </Button>
    </div>
  );
}
