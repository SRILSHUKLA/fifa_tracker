import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { LogFixtureSheet } from "./log-fixture-sheet";
import { PlayerAvatar } from "../player-avatar";
import { displayName } from "@/lib/format";
import type { LeagueFixtureWithPlayers } from "@/lib/queries/leagues";
import { scoreFromPerspective } from "./champion-banner";

function PlayerSlot({
  player,
  align,
}: {
  player: LeagueFixtureWithPlayers["player_one"];
  align: "left" | "right";
}) {
  if (!player) {
    return (
      <View
        className={`min-w-0 flex-1 flex-row items-center gap-2 ${
          align === "right" ? "flex-row-reverse justify-end" : ""
        }`}
      >
        <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
          <Text className="text-[10px] text-muted">?</Text>
        </View>
        <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-muted">
          TBD
        </Text>
      </View>
    );
  }

  return (
    <View
      className={`min-w-0 flex-1 flex-row items-center gap-2 ${
        align === "right" ? "flex-row-reverse justify-end" : ""
      }`}
    >
      <PlayerAvatar person={player} size="sm" />
      <Text
        numberOfLines={1}
        className={`min-w-0 flex-1 text-sm font-medium ${
          align === "right" ? "text-right" : ""
        } text-foreground`}
      >
        {displayName(player)}
      </Text>
    </View>
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

  const bothDecided =
    fixture.player_one != null && fixture.player_two != null;
  const canLog =
    fixture.status === "pending" &&
    bothDecided &&
    (fixture.player_one!.id === viewerId ||
      fixture.player_two!.id === viewerId);

  const score = scoreFromPerspective(fixture);

  return (
    <>
      <Pressable
        disabled={!canLog}
        accessibilityRole={canLog ? "button" : "none"}
        accessibilityLabel={
          canLog ? "Log this fixture's result" : undefined
        }
        onPress={() => setOpen(true)}
        className={`w-full flex-row items-center gap-3 rounded-xl border bg-surface p-3 ${
          canLog ? "border-accent/40 active:opacity-70" : "border-border"
        }`}
      >
        <PlayerSlot player={fixture.player_one} align="left" />

        <View className="shrink-0 items-center">
          {score ? (
            <Text style={{ fontVariant: ["tabular-nums"] }} className="text-lg font-bold text-foreground">
              {score.one}–{score.two}
              {fixture.penalty_winner_id && (
                <Text className="ml-1 text-[10px] font-medium text-muted">
                  pens
                </Text>
              )}
            </Text>
          ) : (
            <Text className="text-xs font-medium uppercase tracking-wide text-muted">
              {bothDecided ? "vs" : "—"}
            </Text>
          )}
        </View>

        <PlayerSlot player={fixture.player_two} align="right" />
      </Pressable>

      {canLog && (
        <LogFixtureSheet
          key={`${fixture.id}-${open}`}
          fixture={fixture}
          leagueId={leagueId}
          viewerId={viewerId}
          isOpen={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

/** Round-robin fixtures first, then knockout rounds, in round order. */
export function LeagueFixtureList({
  fixtures,
  leagueId,
  viewerId,
}: {
  fixtures: LeagueFixtureWithPlayers[];
  leagueId: string;
  viewerId: string;
}) {
  if (fixtures.length === 0) {
    return (
      <Text className="py-4 text-center text-sm text-muted">
        Fixtures appear once the league starts.
      </Text>
    );
  }

  // Group by stage + round for section headers.
  const sections = new Map<string, LeagueFixtureWithPlayers[]>();
  for (const fixture of fixtures) {
    const label =
      fixture.stage === "knockout"
        ? `Knockout · Round ${fixture.round}`
        : `Round ${fixture.round}`;
    if (!sections.has(label)) sections.set(label, []);
    sections.get(label)!.push(fixture);
  }

  return (
    <View className="gap-4">
      {[...sections.entries()].map(([label, roundFixtures]) => (
        <View key={label} className="gap-2">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {label}
          </Text>
          {roundFixtures.map((fixture) => (
            <LeagueFixtureCard
              key={fixture.id}
              fixture={fixture}
              leagueId={leagueId}
              viewerId={viewerId}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
