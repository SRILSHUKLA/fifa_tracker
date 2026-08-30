import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Num } from "../screen";
import { PlayerAvatar } from "../player-avatar";
import { TeamBadge } from "../team-badge";
import { displayName, signed } from "@/lib/format";
import type { LeagueStandingRow, Team } from "@/types/database.types";

/**
 * Round-robin standings for one league. Same table shape as the group
 * leaderboard, plus each player's locked-in league team. Knockout results
 * never affect this table (get_league_standings).
 *
 * Rendered as rows rather than a real <table> — RN has no tables and the
 * grid reads better on a narrow phone.
 */
export function LeagueStandingsTable({
  standings,
  viewerId,
  groupId,
  teams,
}: {
  standings: LeagueStandingRow[];
  viewerId: string;
  groupId: string;
  teams: Team[];
}) {
  const router = useRouter();
  if (standings.length === 0) return null;

  return (
    <View className="rounded-xl border border-border">
      {/* Header */}
      <View className="flex-row items-center border-b border-border bg-surface px-3 py-2">
        <Text className="w-6 text-[11px] font-medium uppercase text-muted">#</Text>
        <Text className="min-w-0 flex-1 text-[11px] font-medium uppercase text-muted">
          Player
        </Text>
        <Text className="w-7 text-right text-[11px] font-medium uppercase text-muted">P</Text>
        <Text className="w-7 text-right text-[11px] font-medium uppercase text-muted">W</Text>
        <Text className="w-7 text-right text-[11px] font-medium uppercase text-muted">D</Text>
        <Text className="w-7 text-right text-[11px] font-medium uppercase text-muted">L</Text>
        <Text className="w-9 text-right text-[11px] font-medium uppercase text-muted">GD</Text>
        <Text className="ml-2 w-8 text-right text-[11px] font-medium uppercase text-muted">Pts</Text>
      </View>

      {standings.map((row, index) => {
        const isMe = row.id === viewerId;
        const team =
          teams.find((t) => t.id === row.team_id) ?? {
            name: row.team_name,
            short_name: null,
            logo_url: null,
          };

        return (
          <Pressable
            key={row.id}
            disabled={isMe}
            accessibilityRole={isMe ? "none" : "button"}
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
              <TeamBadge team={team} size="sm" />
            </View>

            <Num className="w-7 text-right text-sm text-muted">{row.played}</Num>
            <Num className="w-7 text-right text-sm text-foreground">{row.wins}</Num>
            <Num className="w-7 text-right text-sm text-foreground">{row.draws}</Num>
            <Num className="w-7 text-right text-sm text-foreground">{row.losses}</Num>
            <Num
              className={`w-9 text-right text-sm ${
                row.goal_difference > 0
                  ? "text-win"
                  : row.goal_difference < 0
                    ? "text-loss"
                    : "text-foreground"
              }`}
            >
              {signed(row.goal_difference)}
            </Num>
            <Num className="ml-2 w-8 text-right text-sm font-bold text-foreground">
              {row.points}
            </Num>
          </Pressable>
        );
      })}
    </View>
  );
}
