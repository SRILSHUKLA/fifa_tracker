import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { PlayerAvatar } from "./player-avatar";
import { Num } from "./screen";
import { displayName, matchDate } from "@/lib/format";
import { fromPerspective, type MatchWithPlayers } from "@/lib/queries/matches";
import { teamLabel } from "@/lib/queries/teams";

const ACCENT = {
  win: "#30c463",
  draw: "#a1a1aa",
  loss: "#ef4444",
} as const;

const SCORE_TONE = {
  win: "text-win",
  draw: "text-foreground",
  loss: "text-loss",
} as const;

/**
 * One match, always framed from `viewerId`'s point of view: their score on
 * the left, opponent on the right, regardless of which column of the row
 * they occupy in the database.
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
  /** Rendered beside the card (e.g. an edit button). */
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const { them, myScore, theirScore, myTeam, theirTeam, result } =
    fromPerspective(match, viewerId);

  const opponentName = displayName(them);
  const myTeamLabel = teamLabel(myTeam);
  const theirTeamLabel = teamLabel(theirTeam);

  const body = (
    <View
      className="flex-row items-center gap-3 rounded-xl border border-border border-l-4 bg-surface p-3"
      style={{ borderLeftColor: ACCENT[result] }}
    >
      <PlayerAvatar person={them} size="md" />

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-semibold leading-tight text-foreground">
          {opponentName}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted">
          {matchDate(match.played_at)}
          {(myTeam || theirTeam) && (
            <>
              {"  ·  "}
              {myTeamLabel ?? "?"} v {theirTeamLabel ?? "?"}
            </>
          )}
        </Text>
      </View>

      <Num className={`shrink-0 text-2xl font-bold ${SCORE_TONE[result]}`}>
        {`${myScore}–${theirScore}`}
      </Num>
    </View>
  );

  const card = showOpponentLink ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${opponentName}: ${myScore}–${theirScore}, ${result}`}
      onPress={() =>
        router.push(`/groups/${match.group_id}/members/${them.username}`)
      }
      className="min-w-0 flex-1 active:opacity-60"
    >
      {body}
    </Pressable>
  ) : (
    <View className="min-w-0 flex-1">{body}</View>
  );

  if (!action) return card;

  return (
    <View className="flex-row items-stretch gap-2">
      {card}
      {action}
    </View>
  );
}
