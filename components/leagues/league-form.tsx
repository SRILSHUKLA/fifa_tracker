"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { createLeagueAction } from "@/app/(app)/leagues/actions";
import { leagueTypeDescription, leagueTypeLabel } from "@/components/leagues/league-type-label";
import { TeamCombobox } from "@/components/match/team-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeagueType, Team } from "@/types/database.types";

const KNOCKOUT_SIZES = [2, 4, 8, 16] as const;
const TYPES: LeagueType[] = ["single_round_robin", "double_round_robin", "round_robin_knockout"];

/**
 * Creates a league. The creator also picks their own team here and is
 * seated as the league's first participant the moment it's created — see
 * create_league() in 0005_leagues.sql.
 */
export function LeagueForm({
  groups,
  teams,
  defaultGroupId,
}: {
  groups: { id: string; name: string }[];
  teams: Team[];
  defaultGroupId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [groupId, setGroupId] = useState<string | null>(
    (defaultGroupId && groups.some((g) => g.id === defaultGroupId)
      ? defaultGroupId
      : groups[0]?.id) ?? null,
  );
  const [name, setName] = useState("");
  const [type, setType] = useState<LeagueType>("single_round_robin");
  const [knockoutSize, setKnockoutSize] = useState(4);
  const [teamId, setTeamId] = useState<number | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId) ?? null,
    [groups, groupId],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!groupId) {
      toast.error("Choose a group first.");
      return;
    }
    if (!teamId) {
      toast.error("Pick your team.");
      return;
    }

    startTransition(async () => {
      const result = await createLeagueAction(
        groupId,
        name,
        type,
        teamId,
        type === "round_robin_knockout" ? knockoutSize : null,
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.league.name} created.`);
      router.push(`/leagues/${result.league.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {groups.length > 1 && (
        <div className="space-y-2">
          <Label>Group</Label>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  g.id === groupId
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="league-name">League name</Label>
        <Input
          id="league-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={selectedGroup ? `${selectedGroup.name} League` : "Sunday League"}
          maxLength={40}
          className="h-12"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <div className="space-y-2">
          {TYPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                type === option ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <p className="font-medium">{leagueTypeLabel(option)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {leagueTypeDescription(option)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {type === "round_robin_knockout" && (
        <div className="space-y-2">
          <Label>Players who advance to the knockout stage</Label>
          <Select
            value={String(knockoutSize)}
            onValueChange={(value) => setKnockoutSize(Number(value))}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOCKOUT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  Top {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The league needs at least this many players joined before it can start.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Your team</Label>
        <TeamCombobox teams={teams} value={teamId} onChange={setTeamId} label="Your team" />
        <p className="text-xs text-muted-foreground">
          This is the team you&apos;ll play as for every match in this league.
        </p>
      </div>

      <Button
        type="submit"
        disabled={pending || !groupId || !teamId}
        className="h-13 w-full text-base"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Create league
      </Button>
    </form>
  );
}
