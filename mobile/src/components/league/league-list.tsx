import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { LeagueStatusBadge, leagueTypeLabel } from "./meta";
import type { League } from "@/types/database.types";

/** One league row — the group page's Leagues section and the cross-group
 * /leagues index both render this. */
export function LeagueList({
  leagues,
  participantCounts,
}: {
  leagues: League[];
  participantCounts: Record<string, number>;
}) {
  const router = useRouter();

  return (
    <View className="gap-2">
      {leagues.map((league) => {
        const count = participantCounts[league.id] ?? 0;

        return (
          <Pressable
            key={league.id}
            accessibilityRole="button"
            accessibilityLabel={`Open league ${league.name}`}
            onPress={() => router.push(`/leagues/${league.id}`)}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3 active:opacity-60"
          >
            <View className="min-w-0 flex-1">
              <Text
                numberOfLines={1}
                className="font-medium leading-tight text-foreground"
              >
                {league.name}
              </Text>
              <Text numberOfLines={1} className="text-xs text-muted">
                {leagueTypeLabel(league.type)} · {count}{" "}
                {count === 1 ? "player" : "players"}
              </Text>
            </View>

            <View className="shrink-0">
              <LeagueStatusBadge status={league.status} />
            </View>
            <ChevronRight size={16} color="#a1a1aa" strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}
