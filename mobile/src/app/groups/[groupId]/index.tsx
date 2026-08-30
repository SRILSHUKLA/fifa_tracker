import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronRight,
  LogOut,
  Pencil,
  Swords,
  Trophy,
  UserMinus,
} from "lucide-react-native";
import type { JSX } from "react";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Dialog } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { InviteShare } from "@/components/invite-share";
import { LeagueList } from "@/components/league/league-list";
import { MatchCard } from "@/components/match-card";
import { BackButton, Num } from "@/components/screen";
import { MemberRow } from "@/components/member-list";
import { RecordCard, StatTile } from "@/components/stat-tile";
import { TeamBadge } from "@/components/team-badge";
import { useAuth } from "@/lib/auth";
import {
  useGroup,
  useGroupLeagues,
  useGroupMembers,
  useGroupTeamStats,
  useLeaderboard,
  useLeagueCounts,
  useLeaveGroup,
  useMatches,
  useRecentForm,
  useRemoveMember,
  useRenameGroup,
  useTeams,
} from "@/lib/hooks";
import { decimal, signed } from "@/lib/format";

export default function GroupDetailScreen(): JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId =
    typeof params.groupId === "string" ? params.groupId : "";

  const { session } = useAuth();
  const userId = session?.user.id;

  const groupQuery = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const leaderboard = useLeaderboard(groupId);
  const matches = useMatches({ groupId, limit: 5 });
  const form = useRecentForm(userId, groupId);
  const teamStats = useGroupTeamStats(groupId);
  const leagues = useGroupLeagues(groupId);
  const leagueCounts = useLeagueCounts((leagues.data ?? []).map((l) => l.id));
  const teams = useTeams();

  if (!userId) return null;

  const group = groupQuery.data ?? null;

  if (groupQuery.isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Groups" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted">Loading…</Text>
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center px-2">
          <BackButton label="Groups" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-muted">
            This group doesn’t exist, or you’re not in it.
          </Text>
        </View>
      </View>
    );
  }

  const isOwner = group.owner_id === userId;
  const memberRows = members.data ?? [];
  const myRow = (leaderboard.data ?? []).find((row) => row.id === userId) ?? null;
  const played = myRow?.played ?? 0;
  const topTeam = (teamStats.data ?? [])[0] ?? null;
  // get_group_team_stats returns only id/name — the full list is already in
  // memory, so look the crest up rather than adding a join to that RPC.
  const topTeamInfo = topTeam
    ? (teams.data ?? []).find((t) => t.id === topTeam.team_id) ?? null
    : null;

  function refetchAll() {
    members.refetch();
    leaderboard.refetch();
    matches.refetch();
    form.refetch();
    teamStats.refetch();
    leagues.refetch();
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center px-2">
        <BackButton label="Groups" />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-16 pt-1"
        refreshControl={
          <RefreshControl
            refreshing={leaderboard.isFetching || members.isFetching}
            onRefresh={refetchAll}
            tintColor="#a1a1aa"
            progressBackgroundColor="#17171a"
          />
        }
      >
        {/* Title row ---------------------------------------------------- */}
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="text-[26px] leading-8 font-bold tracking-tight text-foreground"
            >
              {group.name}
            </Text>
            <Text className="mt-0.5 text-sm text-muted">
              {memberRows.length}{" "}
              {memberRows.length === 1 ? "member" : "members"}
            </Text>
          </View>

          {isOwner ? (
            <RenameDialog group={group} />
          ) : (
            <LeaveDialog groupId={group.id} />
          )}
        </View>

        <InviteShare
          groupId={group.id}
          inviteCode={group.invite_code}
          isOwner={isOwner}
        />

        {/* Your stats in this group ------------------------------------- */}
        <View className="mt-4">
          <RecordCard
            heading="Your record here"
            played={played}
            points={myRow?.points ?? 0}
            wins={myRow?.wins ?? 0}
            draws={myRow?.draws ?? 0}
            losses={myRow?.losses ?? 0}
            form={form.data ?? []}
          />
        </View>

        <View className="mt-4 flex-row gap-2">
          <StatTile
            label="Win rate"
            value={myRow?.win_pct != null ? `${decimal(myRow.win_pct)}%` : "—"}
            className="flex-1"
          />
          <StatTile
            label="Goal diff"
            value={signed(myRow?.goal_difference ?? 0)}
            tone={
              (myRow?.goal_difference ?? 0) > 0
                ? "win"
                : (myRow?.goal_difference ?? 0) < 0
                  ? "loss"
                  : "draw"
            }
            className="flex-1"
          />
          <StatTile
            label="Table spot"
            value={
              myRow
                ? `#${(leaderboard.data ?? []).findIndex(
                    (row) => row.id === userId,
                  ) + 1}`
                : "—"
            }
            className="flex-1"
          />
        </View>

        {/* Go-to team --------------------------------------------------- */}
        {topTeam && (
          <View className="mt-4 rounded-xl border border-border bg-surface p-4">
            <Text className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Your go-to team here
            </Text>
            <View className="mt-1.5 flex-row items-center justify-between gap-3">
              <View className="flex-row min-w-0 flex-1 items-center gap-2">
                <TeamBadge team={topTeamInfo ?? { name: topTeam.team_name }} size="md" />
                <Text
                  numberOfLines={1}
                  className="min-w-0 shrink font-semibold text-foreground"
                >
                  {topTeam.team_name}
                </Text>
              </View>
              <Num className="shrink-0 text-sm text-muted">
                {`${topTeam.wins}W ${topTeam.draws}D ${topTeam.losses}L in ${topTeam.played}`}
              </Num>
            </View>
          </View>
        )}

        {/* Log match CTA -------------------------------------------------- */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/match/new?group=${group.id}`)}
          className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80"
        >
          <Swords size={16} color="#fcfcfc" strokeWidth={2} />
          <Text className="text-[15px] font-semibold text-accent-foreground">
            Log a match
          </Text>
        </Pressable>

        {/* Leagues ---------------------------------------------------------- */}
        <View className="mt-6 gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm font-semibold text-foreground">Leagues</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/leagues/new?group=${group.id}`)}
              className="active:opacity-60"
            >
              <Text className="text-sm font-medium text-accent">New league</Text>
            </Pressable>
          </View>

          {(leagues.data ?? []).length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No leagues yet"
              description="Start a round robin or knockout among this group's members."
              action={{
                href: `/leagues/new?group=${group.id}`,
                label: "Start a league",
              }}
            />
          ) : (
            <LeagueList
              leagues={leagues.data ?? []}
              participantCounts={leagueCounts.data ?? {}}
            />
          )}
        </View>

        {/* Members ---------------------------------------------------------- */}
        <View className="mt-6 gap-3">
          <Text className="text-sm font-semibold text-foreground">Members</Text>

          <View className="gap-2">
            {memberRows.map((member) => {
              const isSelf = member.id === userId;

              const row = (
                <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
                  <MemberRow member={member} viewerId={userId} />
                  {!isSelf && (
                    <>
                      <ChevronRight size={16} color="#a1a1aa" strokeWidth={2} />
                      {isOwner && (
                        <RemoveButton groupId={group.id} memberId={member.id} />
                      )}
                    </>
                  )}
                </View>
              );

              return isSelf ? (
                <View key={member.id}>{row}</View>
              ) : (
                <Pressable
                  key={member.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Head to head with ${member.username}`}
                  onPress={() =>
                    router.push(`/groups/${group.id}/members/${member.username}`)
                  }
                  className="active:opacity-60"
                >
                  {row}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Recent matches ------------------------------------------------------ */}
        <View className="mt-6 gap-3">
          <Text className="text-sm font-semibold text-foreground">
            Recent matches
          </Text>

          {(matches.data ?? []).length === 0 ? (
            <EmptyState
              icon={Swords}
              title="No matches yet"
              description="Log the first result and this group's stats start filling in."
              action={{
                href: `/match/new?group=${group.id}`,
                label: "Log a match",
              }}
            />
          ) : (
            <View className="gap-2">
              {(matches.data ?? []).map((match) => (
                <MatchCard key={match.id} match={match} viewerId={userId} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}



function RenameDialog({
  group,
}: {
  group: { id: string; name: string };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const rename = useRenameGroup(group.id);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rename group"
        hitSlop={8}
        onPress={() => setOpen(true)}
        className="rounded-lg border border-border p-2 active:opacity-60"
      >
        <Pencil size={16} color="#a1a1aa" strokeWidth={2} />
      </Pressable>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-[320px] self-center">
            <Dialog.Title>Rename group</Dialog.Title>

            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoFocus
              className="mt-3 h-11 rounded-xl border border-border bg-background px-3 text-[15px] text-foreground"
            />

            <View className="mt-4 flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  setName(group.name);
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                isDisabled={
                  rename.isPending ||
                  name.trim().length < 2 ||
                  name.trim() === group.name
                }
                onPress={() =>
                  rename.mutate(name.trim(), {
                    onSuccess: () => setOpen(false),
                  })
                }
              >
                {rename.isPending ? "Saving…" : "Save"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}

function LeaveDialog({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const leave = useLeaveGroup(() => router.replace("/groups"));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave group"
        hitSlop={8}
        onPress={() => setOpen(true)}
        className="rounded-lg border border-border p-2 active:opacity-60"
      >
        <LogOut size={16} color="#ef4444" strokeWidth={2} />
      </Pressable>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-[320px] self-center">
            <Dialog.Title>Leave this group?</Dialog.Title>
            <Dialog.Description>
              You’ll stop seeing its table and can no longer log matches
              against its members. Your past results are kept.
            </Dialog.Description>

            <View className="mt-4 flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                isDisabled={leave.isPending}
                onPress={() => leave.mutate({ groupId })}
              >
                {leave.isPending ? "Leaving…" : "Leave"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}

function RemoveButton({
  groupId,
  memberId,
}: {
  groupId: string;
  memberId: string;
}) {
  const [open, setOpen] = useState(false);
  const removeMember = useRemoveMember(groupId);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove from group"
        hitSlop={6}
        onPress={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-border p-2 active:opacity-60"
      >
        <UserMinus size={14} color="#ef4444" strokeWidth={2} />
      </Pressable>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-[320px] self-center">
            <Dialog.Title>Remove this member?</Dialog.Title>
            <Dialog.Description>
              They’ll lose access to the group. Their past matches are kept.
            </Dialog.Description>

            <View className="mt-4 flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                isDisabled={removeMember.isPending}
                onPress={() =>
                  removeMember.mutate(memberId, {
                    onSuccess: () => setOpen(false),
                  })
                }
              >
                {removeMember.isPending ? "Removing…" : "Remove"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
