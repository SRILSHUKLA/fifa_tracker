"use client";

import { useState } from "react";

import { LogFixtureResultDialog } from "@/components/leagues/log-fixture-result-dialog";
import { PlayerAvatar } from "@/components/player-avatar";
import { displayName } from "@/lib/format";
import type { LeagueFixtureWithPlayers } from "@/lib/queries/leagues";
import { cn } from "@/lib/utils";

type FixturePlayer = LeagueFixtureWithPlayers["player_one"];

/**
 * The match's player_one/player_two do not necessarily line up with the
 * fixture's — matches.player_one_id is always whoever logged it (see
 * lib/queries/matches.ts), not whichever side the fixture originally seeded.
 * Scores must be matched up by id, not by position.
 */
function scoreFromPerspective(fixture: LeagueFixtureWithPlayers) {
  if (!fixture.match || !fixture.player_one || !fixture.player_two) return null;

  const oneScore =
    fixture.match.player_one_id === fixture.player_one.id
      ? fixture.match.player_one_score
      : fixture.match.player_two_score;
  const twoScore =
    fixture.match.player_one_id === fixture.player_two.id
      ? fixture.match.player_one_score
      : fixture.match.player_two_score;

  return { one: oneScore, two: twoScore };
}

function PlayerSlot({
  player,
  align,
}: {
  player: FixturePlayer;
  align: "left" | "right";
}) {
  if (!player) {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          align === "right" && "flex-row-reverse text-right",
        )}
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
          ?
        </div>
        <span className="truncate text-sm text-muted-foreground">TBD</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <PlayerAvatar person={player} size="sm" />
      <span className="min-w-0 truncate text-sm font-medium">{displayName(player)}</span>
    </div>
  );
}

/** One fixture — tap it to log the result, if you're one of the two players. */
export function LeagueFixtureCard({
  fixture,
  leagueId,
  viewerId,
}: {
  fixture: LeagueFixtureWithPlayers;
  leagueId: string;
  viewerId: string;
}) {
  const [open, setOpen] = useState(false);

  const bothDecided = fixture.player_one != null && fixture.player_two != null;
  const canLog =
    fixture.status === "pending" &&
    bothDecided &&
    (fixture.player_one!.id === viewerId || fixture.player_two!.id === viewerId);

  const score = scoreFromPerspective(fixture);

  const middle = score ? (
    <p className="tnum shrink-0 text-lg font-bold">
      {score.one}
      <span className="mx-1 text-muted-foreground">–</span>
      {score.two}
      {fixture.penalty_winner_id && (
        <span className="ml-1 text-[10px] font-medium text-muted-foreground">pens</span>
      )}
    </p>
  ) : (
    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {bothDecided ? "vs" : "—"}
    </span>
  );

  const body = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        canLog && "border-primary/40",
      )}
    >
      <PlayerSlot player={fixture.player_one} align="left" />
      {middle}
      <PlayerSlot player={fixture.player_two} align="right" />
    </div>
  );

  if (!canLog) return body;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {body}
      </button>
      <LogFixtureResultDialog
        fixture={fixture}
        leagueId={leagueId}
        viewerId={viewerId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
