import Link from "next/link";

import { PlayerAvatar } from "@/components/player-avatar";
import { matchDate, displayName, fullDate } from "@/lib/format";
import { fromPerspective, type MatchWithPlayers } from "@/lib/queries/matches";
import { teamLabel } from "@/lib/queries/teams";
import { cn } from "@/lib/utils";

/**
 * One match, always framed from `viewerId`'s point of view: their score on the
 * left, opponent on the right, regardless of which column of the row they
 * occupy in the database.
 */
export function MatchCard({
  match,
  viewerId,
  showOpponentLink = true,
}: {
  match: MatchWithPlayers;
  viewerId: string;
  showOpponentLink?: boolean;
}) {
  const { them, myScore, theirScore, myTeam, theirTeam, result } =
    fromPerspective(match, viewerId);

  const accent = {
    win: "border-l-win",
    draw: "border-l-draw",
    loss: "border-l-loss",
  }[result];

  const scoreTone = {
    win: "text-win",
    draw: "text-foreground",
    loss: "text-loss",
  }[result];

  const opponentName = displayName(them);

  const body = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-l-4 border-border bg-card p-3",
        accent,
      )}
    >
      <PlayerAvatar person={them} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{opponentName}</p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={fullDate(match.played_at)}
        >
          {matchDate(match.played_at)}
          {(myTeam || theirTeam) && (
            <>
              {" · "}
              {teamLabel(myTeam) ?? "?"} v {teamLabel(theirTeam) ?? "?"}
            </>
          )}
        </p>
      </div>

      <p className={cn("tnum shrink-0 text-2xl font-bold", scoreTone)}>
        {myScore}
        <span className="mx-0.5 text-muted-foreground">–</span>
        {theirScore}
      </p>
    </div>
  );

  if (!showOpponentLink) return body;

  return (
    <Link
      href={`/friends/${them.username}`}
      className="block transition-opacity active:opacity-70"
      aria-label={`${opponentName}: ${myScore}–${theirScore}, ${result}`}
    >
      {body}
    </Link>
  );
}
