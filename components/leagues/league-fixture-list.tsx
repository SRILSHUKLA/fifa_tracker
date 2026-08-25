import { LeagueFixtureCard } from "@/components/leagues/league-fixture-card";
import type { LeagueFixtureWithPlayers } from "@/lib/queries/leagues";

/** "Final" / "Semifinals" / "Quarterfinals" counted back from the last round. */
function knockoutRoundLabel(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}

/**
 * Every fixture in a league. Knockout rounds (if any) are grouped and
 * labeled first — this doubles as the bracket view, a stacked round-by-round
 * list rather than a graphical tree (kept deliberately simple for v1). The
 * round-robin phase is then split into "yours" and everyone else's, so the
 * fixtures you can actually act on aren't buried in the full list.
 */
export function LeagueFixtureList({
  fixtures,
  leagueId,
  viewerId,
}: {
  fixtures: LeagueFixtureWithPlayers[];
  leagueId: string;
  viewerId: string;
}) {
  const roundRobin = fixtures.filter((f) => f.stage === "round_robin");
  const knockout = fixtures.filter((f) => f.stage === "knockout");

  const yours = roundRobin.filter(
    (f) => f.player_one?.id === viewerId || f.player_two?.id === viewerId,
  );
  const others = roundRobin.filter(
    (f) => f.player_one?.id !== viewerId && f.player_two?.id !== viewerId,
  );

  const totalKnockoutRounds = knockout.reduce((max, f) => Math.max(max, f.round), 0);
  const knockoutRounds = [...new Set(knockout.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {knockoutRounds.map((round) => (
        <div key={`knockout-${round}`} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {knockoutRoundLabel(round, totalKnockoutRounds)}
          </h3>
          <div className="space-y-2">
            {knockout
              .filter((f) => f.round === round)
              .map((f) => (
                <LeagueFixtureCard key={f.id} fixture={f} leagueId={leagueId} viewerId={viewerId} />
              ))}
          </div>
        </div>
      ))}

      {yours.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your fixtures
          </h3>
          <div className="space-y-2">
            {yours.map((f) => (
              <LeagueFixtureCard key={f.id} fixture={f} leagueId={leagueId} viewerId={viewerId} />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Other fixtures
          </h3>
          <div className="space-y-2">
            {others.map((f) => (
              <LeagueFixtureCard key={f.id} fixture={f} leagueId={leagueId} viewerId={viewerId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
