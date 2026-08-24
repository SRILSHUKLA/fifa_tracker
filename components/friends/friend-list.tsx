import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { displayName } from "@/lib/format";
import type { FriendSummary } from "@/types/database.types";

/**
 * Accepted friends, each showing the current user's record against them.
 * Tapping through opens the head-to-head.
 */
export function FriendList({ friends }: { friends: FriendSummary[] }) {
  return (
    <ul className="space-y-2">
      {friends.map((friend) => (
        <li key={friend.id}>
          <Link
            href={`/friends/${friend.username}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-opacity active:opacity-70"
          >
            <PlayerAvatar person={friend} size="md" />

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight">
                {displayName(friend)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {friend.played === 0 ? (
                  "Never played"
                ) : (
                  <>
                    <span className="text-win">{friend.wins}W</span>
                    {" · "}
                    <span className="text-draw">{friend.draws}D</span>
                    {" · "}
                    <span className="text-loss">{friend.losses}L</span>
                  </>
                )}
              </p>
            </div>

            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
