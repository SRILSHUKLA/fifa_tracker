import Link from "next/link";

import { PlayerAvatar } from "@/components/player-avatar";
import { TeamBadge } from "@/components/team-badge";
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
  action,
}: {
  match: MatchWithPlayers;
  viewerId: string;
  showOpponentLink?: boolean;
  /** Rendered as a sibling next to the card, e.g. an edit button — kept
   * outside the opponent-profile Link so the two never fight over clicks. */
  action?: React.ReactNode;
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
        <div
          className="flex items-center gap-1 truncate text-xs text-muted-foreground"
          title={fullDate(match.played_at)}
        >
          <span className="truncate">{matchDate(match.played_at)}</span>
          {(myTeam || theirTeam) && (
            <span className="flex shrink-0 items-center gap-1">
              <span>·</span>
              <TeamBadge team={myTeam} size="sm" className="size-4" />
              <span>{teamLabel(myTeam) ?? "?"} v {teamLabel(theirTeam) ?? "?"}</span>
              <TeamBadge team={theirTeam} size="sm" className="size-4" />
            </span>
          )}
        </div>
      </div>

      <p className={cn("tnum shrink-0 text-2xl font-bold", scoreTone)}>
        {myScore}
        <span className="mx-0.5 text-muted-foreground">–</span>
        {theirScore}
      </p>
    </div>
  );

  const card = showOpponentLink ? (
    <Link
      href={`/groups/${match.group_id}/members/${them.username}`}
      // min-w-0 matters once `action` puts this inside a flex row below —
      // without it, a flex item defaults to a min-width equal to its own
      // content's natural size, which can exceed the row's available space
      // (the team-badge line inside `body` has a shrink-0 span) and push
      // the whole row wider than its container, shoving the action button
      // off past the edge instead of letting the card's own truncation do
      // its job.
      className="block min-w-0 flex-1 transition-opacity active:opacity-70"
      aria-label={`${opponentName}: ${myScore}–${theirScore}, ${result}`}
    >
      {body}
    </Link>
  ) : (
    <div className="min-w-0 flex-1">{body}</div>
  );

  if (!action) return card;

  return (
    <div className="flex items-stretch gap-2">
      {card}
      {action}
    </div>
  );
}
