import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { displayName } from "@/lib/format";
import type { GroupMemberSummary } from "@/types/database.types";

/**
 * One member row: avatar, name, and the current user's record against them
 * within this group. Exported separately from MemberList so pages that need
 * to attach extra controls per row (e.g. the owner's remove button on the
 * group detail page) can compose it directly instead of nesting lists.
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
    <div className="flex min-w-0 items-center gap-3">
      <PlayerAvatar person={member} size="md" highlight={isSelf} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium leading-tight">
          {displayName(member)}
          {isSelf && (
            <span className="text-xs font-normal text-muted-foreground">
              (you)
            </span>
          )}
          {member.role === "owner" && (
            <Crown className="size-3.5 shrink-0 text-primary" />
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {isSelf ? (
            "This is you"
          ) : member.played === 0 ? (
            "Never played"
          ) : (
            <>
              <span className="text-win">{member.wins}W</span>
              {" · "}
              <span className="text-draw">{member.draws}D</span>
              {" · "}
              <span className="text-loss">{member.losses}L</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Roster for one group. Every non-self member links through to their
 * head-to-head; tapping your own row does nothing, since there is nothing
 * to compare yourself against.
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
  return (
    <ul className="space-y-2">
      {members.map((member) => {
        const isSelf = member.id === viewerId;

        const row = (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            <MemberRow member={member} viewerId={viewerId} />
            {!isSelf && (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        );

        return (
          <li key={member.id}>
            {isSelf ? (
              row
            ) : (
              <Link
                href={`/groups/${groupId}/members/${member.username}`}
                className="block transition-opacity active:opacity-70"
              >
                {row}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
