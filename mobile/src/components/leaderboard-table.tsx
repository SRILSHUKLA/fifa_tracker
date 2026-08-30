import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Num } from "./screen";
import { PlayerAvatar } from "./player-avatar";
import { displayName, signed } from "@/lib/format";
import type { GroupLeaderboardRow } from "@/types/database.types";

const STAT_COL = "w-7";
const GD_COL = "w-9";

/**
 * The group leaderboard — one full-column ranked table. Rendered as rows
 * rather than a real <table>: RN has no table primitive and a fixed-column
 * row layout reads cleanly on a narrow phone.
 */
export function LeaderboardTable({
  rows,
  viewerId,
  groupId,
}: {
  rows: GroupLeaderboardRow[];
  viewerId: string;
  groupId: string;
}) {
  const router = useRouter();
  if (rows.length === 0) return null;

  return (
    <View className="rounded-xl border border-border">
      <View className="flex-row items-center border-b border-border bg-surface px-3 py-2">
        <Text className="w-6 text-[11px] font-medium uppercase text-muted">#</Text>
        <Text className="min-w-0 flex-1 text-[11px] font-medium uppercase text-muted">
          Player
        </Text>
        <Text className={`text-right text-[11px] font-medium uppercase text-muted ${STAT_COL}`}>P</Text>
        <Text className={`text-right text-[11px] font-medium uppercase text-muted ${STAT_COL}`}>W</Text>
        <Text className={`text-right text-[11px] font-medium uppercase text-muted ${STAT_COL}`}>D</Text>
        <Text className={`text-right text-[11px] font-medium uppercase text-muted ${STAT_COL}`}>L</Text>
        <Text className={`text-right text-[11px] font-medium uppercase text-muted ${GD_COL}`}>GD</Text>
        <Text className="ml-1.5 w-8 text-right text-[11px] font-medium uppercase text-muted">Pts</Text>
      </View>

      {rows.map((row, index) => {
        const isMe = row.id === viewerId;

        return (
          <Pressable
            key={row.id}
            disabled={isMe}
            accessibilityRole={isMe ? "none" : "button"}
            accessibilityLabel={
              isMe
                ? undefined
                : `${displayName(row)}, ${row.points} points`
            }
            onPress={() =>
              router.push(`/groups/${groupId}/members/${row.username}`)
            }
            className={`flex-row items-center border-b border-border/60 px-3 py-2.5 last:border-b-0 active:opacity-60 ${
              isMe ? "bg-accent/10" : ""
            }`}
          >
            <Num
              className={`w-6 text-sm font-semibold ${
                index === 0 ? "text-accent" : "text-muted"
              }`}
            >
              {index + 1}
            </Num>

            <View className="flex min-w-0 flex-1 flex-row items-center gap-2 pr-2">
              <PlayerAvatar person={row} size="sm" highlight={isMe} />
              <Text
                numberOfLines={1}
                className="min-w-0 flex-shrink text-sm font-medium text-foreground"
              >
                {displayName(row)}
              </Text>
            </View>

            <Num className={`text-right text-sm text-muted ${STAT_COL}`}>{row.played}</Num>
            <Num className={`text-right text-sm text-foreground ${STAT_COL}`}>{row.wins}</Num>
            <Num className={`text-right text-sm text-foreground ${STAT_COL}`}>{row.draws}</Num>
            <Num className={`text-right text-sm text-foreground ${STAT_COL}`}>{row.losses}</Num>
            <Num
              className={`text-right text-sm ${GD_COL} ${
                row.goal_difference > 0
                  ? "text-win"
                  : row.goal_difference < 0
                    ? "text-loss"
                    : "text-foreground"
              }`}
            >
              {signed(row.goal_difference)}
            </Num>
            <Num className="ml-1.5 w-8 text-right text-sm font-bold text-foreground">
              {row.points}
            </Num>
          </Pressable>
        );
      })}
    </View>
  );
}
