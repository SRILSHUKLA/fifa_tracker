"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { joinLeagueAction } from "@/app/(app)/leagues/actions";
import { TeamCombobox } from "@/components/match/team-combobox";
import { Button } from "@/components/ui/button";
import type { Team } from "@/types/database.types";

/** Shown on a draft league's page to a group member who hasn't joined yet. */
export function JoinLeagueForm({
  leagueId,
  teams,
}: {
  leagueId: string;
  teams: Team[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function handleJoin() {
    if (!teamId) {
      toast.error("Pick your team first.");
      return;
    }

    startTransition(async () => {
      const result = await joinLeagueAction(leagueId, teamId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("You're in.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Join this league</p>
      <TeamCombobox teams={teams} value={teamId} onChange={setTeamId} label="Your team" />
      <Button onClick={handleJoin} disabled={pending} className="h-11 w-full">
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        <UserPlus className="size-4" />
        Join league
      </Button>
    </div>
  );
}
