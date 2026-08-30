import { ChevronRight, Crown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { PlayerAvatar } from "./player-avatar";
import { displayName } from "@/lib/format";
import type { GroupMemberSummary } from "@/types/database.types";

/**
 * One member row: avatar, name, and the current user's record against them
 * within this group. Composed directly by pages that attach extra controls
 * per row (e.g. the owner's remove button).
 */
export function MemberRow({
  member,
  viewerId,
}: {
  member: GroupMemberSummary;
  viewerId: string;
}) {
  const isSelf = member.id === viewerId;

  return (
    <View className="min-w-0 flex-row items-center gap-3">
      <PlayerAvatar person={member} size="md" highlight={isSelf} />

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="min-w-0 shrink font-medium leading-tight text-foreground"
          >
            {displayName(member)}
          </Text>
          {isSelf && (
            <Text className="shrink-0 text-xs text-muted">(you)</Text>
          )}
          {member.role === "owner" && (
            <Crown size={13} color="#e2402f" strokeWidth={2} />
          )}
        </View>
        <Text numberOfLines={1} className="text-xs text-muted">
          {isSelf ? (
            "This is you"
          ) : member.played === 0 ? (
            "Never played"
          ) : (
            <>
              <Text className="text-xs text-win">{member.wins}W</Text>
              {" · "}
              <Text className="text-xs text-draw">{member.draws}D</Text>
              {" · "}
              <Text className="text-xs text-loss">{member.losses}L</Text>
            </>
          )}
        </Text>
      </View>
    </View>
  );
}

/**
 * Roster for one group. Every non-self member links through to their
 * head-to-head; tapping your own row does nothing — there is nothing to
 * compare yourself against.
 */
export function MemberList({
  groupId,
  members,
  viewerId,
}: {
  groupId: string;
  members: GroupMemberSummary[];
  viewerId: string;
}) {
  const router = useRouter();

  return (
    <View className="gap-2">
      {members.map((member) => {
        const isSelf = member.id === viewerId;

        const card = (
          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
            <MemberRow member={member} viewerId={viewerId} />
            {!isSelf && (
              <ChevronRight size={16} color="#a1a1aa" strokeWidth={2} />
            )}
          </View>
        );

        return isSelf ? (
          <View key={member.id}>{card}</View>
        ) : (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            accessibilityLabel={`Head to head with ${displayName(member)}`}
            onPress={() =>
              router.push(`/groups/${groupId}/members/${member.username}`)
            }
            className="active:opacity-60"
          >
            {card}
          </Pressable>
        );
      })}
    </View>
  );
}
