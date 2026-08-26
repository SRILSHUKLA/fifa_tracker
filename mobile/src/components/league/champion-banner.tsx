import { Trophy } from "lucide-react-native";
import { Text, View } from "react-native";

import { PlayerAvatar } from "../player-avatar";
import { displayName } from "@/lib/format";
import type { LeagueFixtureWithPlayers } from "@/lib/queries/leagues";

type Champion = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Shown at the top of a completed league's page. */
export function ChampionBanner({ champion }: { champion: Champion }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
      <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20">
        <Trophy size={20} color="#e2402f" strokeWidth={2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-medium uppercase tracking-wide text-accent">
          Champion
        </Text>
        <Text
          numberOfLines={1}
          className="text-lg font-bold leading-tight text-foreground"
        >
          {displayName(champion)}
        </Text>
      </View>
      <PlayerAvatar person={champion} size="lg" highlight />
    </View>
  );
}

/**
 * The match's player_one/player_two do not necessarily line up with the
 * fixture's — matches.player_one_id is always whoever logged it, not
 * whichever side the fixture originally seeded. Scores are matched up by
 * id, not by position.
 */
export function scoreFromPerspective(fixture: LeagueFixtureWithPlayers) {
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
