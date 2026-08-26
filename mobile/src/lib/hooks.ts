import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "./auth";
import * as groupsApi from "./queries/groups";
import * as matchesApi from "./queries/matches";
import * as statsApi from "./queries/stats";
import * as teamsApi from "./queries/teams";
import * as leaguesApi from "./queries/leagues";
import { toast } from "./toast";

export const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: teamsApi.getTeams,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

export function useMyGroups() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["groups", userId],
    queryFn: () => groupsApi.getMyGroups(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => groupsApi.getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => groupsApi.getGroupMembers(groupId),
    enabled: !!groupId,
  });
}

export function useLeaderboard(groupId: string) {
  return useQuery({
    queryKey: ["leaderboard", groupId],
    queryFn: () => groupsApi.getGroupLeaderboard(groupId),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => groupsApi.createGroup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => toast.error("Could not create the group", error.message),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteCode: string) => groupsApi.joinGroup(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["leagues-open"] });
    },
    onError: (error) => toast.error("Could not join", error.message),
  });
}

export function useLeaveGroup(onDone?: () => void) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId }: { groupId: string }) =>
      groupsApi.leaveGroup(groupId, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.message("You left the group", "Your match history there is kept.");
      onDone?.();
    },
    onError: (error) => toast.error("Could not leave", error.message),
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => groupsApi.removeMember(groupId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: (error) => toast.error("Could not remove them", error.message),
  });
}

export function useRenameGroup(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => groupsApi.renameGroup(groupId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (error) => toast.error("Could not rename", error.message),
  });
}

export function useRegenerateInviteCode(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => groupsApi.regenerateInviteCode(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success("New invite code generated", "The old link no longer works.");
    },
    onError: (error) => toast.error("Could not regenerate", error.message),
  });
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function useRecentForm(playerId: string | undefined, groupId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["form", playerId, groupId, limit],
    queryFn: () => statsApi.getRecentForm(playerId!, groupId!, limit),
    enabled: !!playerId && !!groupId,
  });
}

export function useH2HStats(groupId: string, opponentId: string) {
  return useQuery({
    queryKey: ["h2h", groupId, opponentId],
    queryFn: () => statsApi.getH2HStats(groupId, opponentId),
    enabled: !!groupId && !!opponentId,
  });
}

export function useH2HTeamStats(groupId: string, opponentId: string) {
  return useQuery({
    queryKey: ["h2h-teams", groupId, opponentId],
    queryFn: () => statsApi.getH2HTeamStats(groupId, opponentId),
    enabled: !!groupId && !!opponentId,
  });
}

export function useGroupTeamStats(groupId: string) {
  return useQuery({
    queryKey: ["team-stats", groupId],
    queryFn: () => statsApi.getGroupTeamStats(groupId),
    enabled: !!groupId,
  });
}

export function useProfileByUsername(username: string) {
  return useQuery({
    queryKey: ["profile-username", username],
    queryFn: () => statsApi.getProfileByUsername(username),
    enabled: !!username,
  });
}

/* ------------------------------------------------------------------ */
/* Matches                                                             */
/* ------------------------------------------------------------------ */

export function useMatches(opts: {
  groupId?: string;
  playerId?: string;
  opponentId?: string;
  limit?: number;
  offset?: number;
}) {
  const { groupId, playerId, opponentId, limit = PAGE_SIZE, offset = 0 } = opts;

  return useQuery({
    queryKey: ["matches", groupId ?? null, playerId ?? null, opponentId ?? null, limit, offset],
    queryFn: () =>
      matchesApi.getMatches({
        groupId: groupId || undefined,
        playerId: playerId || undefined,
        opponentId: opponentId || undefined,
        limit,
        offset,
      }),
    enabled: !!(groupId && playerId),
  });
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: () => matchesApi.getMatch(matchId),
    enabled: !!matchId,
  });
}

export function invalidateMatchData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["matches"] });
  queryClient.invalidateQueries({ queryKey: ["match"] });
  queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
  queryClient.invalidateQueries({ queryKey: ["form"] });
  queryClient.invalidateQueries({ queryKey: ["h2h"] });
  queryClient.invalidateQueries({ queryKey: ["h2h-teams"] });
  queryClient.invalidateQueries({ queryKey: ["team-stats"] });
  queryClient.invalidateQueries({ queryKey: ["league"] });
  queryClient.invalidateQueries({ queryKey: ["league-fixtures"] });
  queryClient.invalidateQueries({ queryKey: ["league-standings"] });
}

export function useLogMatch(onSuccess?: () => void) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof matchesApi.createMatch>[1]) =>
      matchesApi.createMatch(userId!, input),
    onSuccess: () => {
      invalidateMatchData(queryClient);
      onSuccess?.();
    },
    onError: (error) => toast.error("Could not save the match", error.message),
  });
}

export function useEditMatch(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: matchesApi.EditMatchInput) => matchesApi.editMatch(input),
    onSuccess: () => {
      invalidateMatchData(queryClient);
      toast.success("Result updated");
      onSuccess?.();
    },
    onError: (error) => toast.error("Could not update the result", error.message),
  });
}

/* ------------------------------------------------------------------ */
/* Leagues                                                             */
/* ------------------------------------------------------------------ */

export function useMyLeagues() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["my-leagues", userId],
    queryFn: () => leaguesApi.getMyLeagues(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useOpenToJoinLeagues(enabled: boolean) {
  const myGroups = useMyGroups();

  return useQuery({
    queryKey: ["leagues-open", myGroups.data?.map((g) => g.group.id).join(",")],
    queryFn: async () => {
      const all = await Promise.all(
        (myGroups.data ?? []).map(({ group }) => leaguesApi.getGroupLeagues(group.id)),
      );
      return all.flat().filter((league) => league.status === "draft");
    },
    enabled: enabled && myGroups.isSuccess,
  });
}

export function useLeague(leagueId: string) {
  return useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => leaguesApi.getLeague(leagueId),
    enabled: !!leagueId,
  });
}

export function useLeagueParticipants(leagueId: string) {
  return useQuery({
    queryKey: ["league-participants", leagueId],
    queryFn: () => leaguesApi.getLeagueParticipants(leagueId),
    enabled: !!leagueId,
  });
}

export function useLeagueFixtures(leagueId: string) {
  return useQuery({
    queryKey: ["league-fixtures", leagueId],
    queryFn: () => leaguesApi.getLeagueFixtures(leagueId),
    enabled: !!leagueId,
  });
}

export function useLeagueStandings(leagueId: string) {
  return useQuery({
    queryKey: ["league-standings", leagueId],
    queryFn: () => leaguesApi.getLeagueStandings(leagueId),
    enabled: !!leagueId,
  });
}

export function useGroupLeagues(groupId: string) {
  return useQuery({
    queryKey: ["leagues", groupId],
    queryFn: () => leaguesApi.getGroupLeagues(groupId),
    enabled: !!groupId,
  });
}

export function useLeagueCounts(leagueIds: string[]) {
  const key = [...leagueIds].sort().join(",");

  return useQuery({
    queryKey: ["league-counts", key],
    queryFn: () => leaguesApi.getParticipantCounts(leagueIds),
    enabled: leagueIds.length > 0,
    staleTime: 10_000,
  });
}

function invalidateLeagues(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
  queryClient.invalidateQueries({ queryKey: ["leagues-open"] });
}

export function useCreateLeague(
  onSuccess?: (league: Awaited<ReturnType<typeof leaguesApi.createLeague>>) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof leaguesApi.createLeague>[0]) =>
      leaguesApi.createLeague(input),
    onSuccess: (league) => {
      invalidateLeagues(queryClient);
      onSuccess?.(league);
    },
    onError: (error) => toast.error("Could not create the league", error.message),
  });
}

export function useJoinLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leagueId, teamId }: { leagueId: string; teamId: number }) =>
      leaguesApi.joinLeague(leagueId, teamId),
    onSuccess: (_data, variables) => {
      invalidateLeagues(queryClient);
      queryClient.invalidateQueries({
        queryKey: ["league-participants", variables.leagueId],
      });
      toast.success("You're in");
    },
    onError: (error) => toast.error("Could not join", error.message),
  });
}

export function useLeaveLeague(leagueId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => leaguesApi.leaveLeague(leagueId, userId!),
    onSuccess: () => {
      invalidateLeagues(queryClient);
      queryClient.invalidateQueries({ queryKey: ["league-participants", leagueId] });
      toast.message("You left the league");
    },
    onError: (error) => toast.error("Could not leave", error.message),
  });
}

export function useStartLeague(leagueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => leaguesApi.startLeague(leagueId),
    onSuccess: () => {
      invalidateLeagues(queryClient);
      queryClient.invalidateQueries({ queryKey: ["league", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["league-fixtures", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["league-standings", leagueId] });
    },
    onError: (error) => toast.error("Could not start the league", error.message),
  });
}

export function useLogFixtureResult(leagueId: string, viewerId: string, onChampion?: (championId: string | null) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      fixtureId: string;
      myScore: number;
      opponentScore: number;
      penaltyWinnerId: string | null;
    }) =>
      leaguesApi.logLeagueFixtureResult({
        fixtureId: input.fixtureId,
        myScore: input.myScore,
        opponentScore: input.opponentScore,
        penaltyWinnerId: input.penaltyWinnerId,
      }),
    onSuccess: (result) => {
      invalidateMatchData(queryClient);
      invalidateLeagues(queryClient);
      if (result.league_status === "completed") {
        onChampion?.(result.champion_id);
        if (result.champion_id === viewerId) {
          toast.success("You're the champion!", "The league is complete.");
        } else {
          toast.message("League complete", "A champion has been crowned.");
        }
      }
    },
    onError: (error) => toast.error("Could not log that result", error.message),
  });
}
