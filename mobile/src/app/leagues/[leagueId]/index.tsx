import { useLocalSearchParams } from "expo-router";
import { LogOut, Swords, Trophy } from "lucide-react-native";
import type { JSX } from "react";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button, Dialog } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components/screen";
import { ChampionBanner } from "@/components/league/champion-banner";
import { leagueTypeDescription, leagueTypeLabel, LeagueStatusBadge } from "@/components/league/meta";
import { LeagueFixtureList } from "@/components/league/league-fixture-card";
import { LeagueStandingsTable } from "@/components/league/league-standings-table";
import { TeamPicker } from "@/components/pickers";
import { PlayerAvatar } from "@/components/player-avatar";
import { useAuth } from "@/lib/auth";
import {
  useGroup,
  useJoinLeague,
  useLeague,
  useLeagueFixtures,
  useLeagueParticipants,
  useLeagueStandings,
  useLeaveLeague,
  useStartLeague,
  useTeams,
} from "@/lib/hooks";
import { displayName } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function LeagueDetailScreen(): JSX.Element | null {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ leagueId?: string }>();
  const leagueId =
    typeof params.leagueId === "string" ? params.leagueId : "";

  const { session } = useAuth();
  const userId = session?.user.id;

  const leagueQuery = useLeague(leagueId);
  const groupQuery = useGroup(leagueQuery.data?.group_id ?? "");
  const participants = useLeagueParticipants(leagueId);
  const fixtures = useLeagueFixtures(leagueId);
  const standings = useLeagueStandings(leagueId);
  const teams = useTeams();

  if (!userId) return null;

  function refetchAll() {
    leagueQuery.refetch();
    participants.refetch();
    fixtures.refetch();
    standings.refetch();
  }

  const league = leagueQuery.data;

  if (leagueQuery.isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Back" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted">Loading…</Text>
        </View>
      </View>
    );
  }

  if (!league) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Back" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-muted">
            This league doesn’t exist, or you’re not in its group.
          </Text>
        </View>
      </View>
    );
  }

  const group = groupQuery.data;
  const participantRows = participants.data ?? [];
  const isParticipant = participantRows.some((p) => p.user_id === userId);
  const isCreator = league.created_by === userId;
  const minParticipants =
    league.type === "round_robin_knockout"
      ? (league.knockout_size ?? 2)
      : 2;

  const championParticipant = league.champion_id
    ? participantRows.find((p) => p.user_id === league.champion_id)
    : null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center px-2">
        <BackButton label={group?.name ?? "Back"} />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-16 pt-1"
        refreshControl={
          <RefreshControl
            refreshing={
              leagueQuery.isFetching || participants.isFetching || fixtures.isFetching
            }
            onRefresh={refetchAll}
            tintColor="#a1a1aa"
            progressBackgroundColor="#17171a"
          />
        }
      >
        {/* Header --------------------------------------------------------- */}
        <View className="mb-5">
          <Text numberOfLines={1} className="text-sm text-muted">
            {group?.name ?? ""}
          </Text>
          <View className="flex-row items-start justify-between gap-3">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 text-[26px] leading-8 font-bold tracking-tight text-foreground"
            >
              {league.name}
            </Text>
            <View className="mt-1.5 shrink-0">
              <LeagueStatusBadge status={league.status} />
            </View>
          </View>
          <Text className="mt-1 text-sm leading-5 text-muted">
            {leagueTypeLabel(league.type)} ·{" "}
            {leagueTypeDescription(league.type)}
          </Text>
        </View>

        {league.status === "completed" && championParticipant && (
          <View className="mb-4">
            <ChampionBanner champion={championParticipant.profile} />
          </View>
        )}

        {league.status === "draft" && (
          <DraftPhase
            leagueId={league.id}
            isParticipant={isParticipant}
            isCreator={isCreator}
            participantCount={participantRows.length}
            minParticipants={minParticipants}
          />
        )}

        {/* Roster ----------------------------------------------------------- */}
        <View className="mt-6 gap-3">
          <Text className="text-sm font-semibold text-foreground">
            Players ({participantRows.length})
          </Text>
          <View className="gap-2">
            {participantRows.map((p) => (
              <View
                key={p.user_id}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-2.5"
              >
                <PlayerAvatar person={p.profile} size="sm" highlight={p.user_id === userId} />
                <Text
                  numberOfLines={1}
                  className="min-w-0 flex-1 font-medium text-foreground"
                >
                  {displayName(p.profile)}
                </Text>
                <TeamBadgeInline teamName={p.team.name} />
              </View>
            ))}
          </View>
        </View>

        {/* Standings + fixtures — only once the league is under way --------- */}
        {league.status !== "draft" && (
          <>
            <View className="mt-6 gap-3">
              <Text className="text-sm font-semibold text-foreground">
                Standings
              </Text>
              <LeagueStandingsTable
                standings={standings.data ?? []}
                viewerId={userId}
                groupId={group?.id ?? ""}
                teams={teams.data ?? []}
              />
            </View>

            <View className="mt-6 gap-3">
              <View className="flex-row items-center gap-1.5">
                <Trophy size={15} color="#a1a1aa" strokeWidth={2} />
                <Text className="text-sm font-semibold text-foreground">
                  Fixtures
                </Text>
              </View>
              <LeagueFixtureList
                fixtures={fixtures.data ?? []}
                leagueId={league.id}
                viewerId={userId}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TeamBadgeInline({ teamName }: { teamName: string }) {
  return (
    <Text
      numberOfLines={1}
      className="max-w-[110px] shrink-0 text-right text-xs text-muted"
    >
      {teamName}
    </Text>
  );
}

/** Draft-phase actions: join by picking a team / start / waiting state. */
function DraftPhase({
  leagueId,
  isParticipant,
  isCreator,
  participantCount,
  minParticipants,
}: {
  leagueId: string;
  isParticipant: boolean;
  isCreator: boolean;
  participantCount: number;
  minParticipants: number;
}) {
  const teams = useTeams();
  const joinLeague = useJoinLeague();
  const startLeague = useStartLeague(leagueId);
  const leaveLeague = useLeaveLeague(leagueId);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pickedTeamId, setPickedTeamId] = useState<number | null>(null);

  if (!isParticipant) {
    return (
      <View className="gap-3 rounded-xl border border-border bg-surface p-4">
        <Text className="text-sm font-semibold text-foreground">
          Join this league
        </Text>
        <TeamPicker
          teams={teams.data ?? []}
          value={pickedTeamId}
          onChange={setPickedTeamId}
          label="Your team"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join league"
          disabled={!pickedTeamId || joinLeague.isPending}
          onPress={() =>
            pickedTeamId &&
            joinLeague.mutate({ leagueId, teamId: pickedTeamId })
          }
          className={`h-11 flex-row items-center justify-center rounded-xl bg-accent active:opacity-80 ${
            !pickedTeamId || joinLeague.isPending ? "opacity-50" : ""
          }`}
        >
          <Swords size={15} color="#fcfcfc" strokeWidth={2} />
          <Text className="ml-2 text-[15px] font-semibold text-accent-foreground">
            {joinLeague.isPending ? "Joining…" : "Join league"}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isCreator) {
    return (
      <View className="gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start the league"
          disabled={
            startLeague.isPending ||
            participantCount < Math.max(minParticipants, 2)
          }
          onPress={() =>
            startLeague.mutate(undefined, {
              onSuccess: () =>
                toast.success(
                  "League started",
                  "Fixtures are ready — go play.",
                ),
              onError: () => {},
            })
          }
          className={`h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80 ${
            startLeague.isPending ||
            participantCount < Math.max(minParticipants, 2)
              ? "opacity-50"
              : ""
          }`}
        >
          <Trophy size={16} color="#fcfcfc" strokeWidth={2} />
          <Text className="text-[15px] font-semibold text-accent-foreground">
            {startLeague.isPending ? "Starting…" : "Start the league"}
          </Text>
        </Pressable>
        <Text className="text-xs text-muted">
          Locks the roster and generates every fixture instantly.
          {participantCount < Math.max(minParticipants, 2)
            ? ` Needs at least ${Math.max(minParticipants, 2)} players.`
            : ""}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <Text className="min-w-0 flex-1 text-sm leading-5 text-muted">
          Waiting for the league creator to start it. Fixtures appear the
          moment they do.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave league"
          hitSlop={6}
          onPress={() => setLeaveOpen(true)}
          className="shrink-0 rounded-lg border border-border p-2.5 active:opacity-60"
        >
          <LogOut size={15} color="#ef4444" strokeWidth={2} />
        </Pressable>
      </View>

      <Dialog isOpen={leaveOpen} onOpenChange={setLeaveOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-[320px] self-center">
            <Dialog.Title>Leave this league?</Dialog.Title>
            <Dialog.Description>
              You can rejoin with a different team any time before it starts.
            </Dialog.Description>

            <View className="mt-4 flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => setLeaveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                isDisabled={leaveLeague.isPending}
                onPress={() =>
                  leaveLeague.mutate(undefined, {
                    onSuccess: () => setLeaveOpen(false),
                  })
                }
              >
                {leaveLeague.isPending ? "Leaving…" : "Leave"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
