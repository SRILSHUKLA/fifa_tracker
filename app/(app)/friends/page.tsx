import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { FriendList } from "@/components/friends/friend-list";
import { FriendSearch } from "@/components/friends/friend-search";
import { RequestList } from "@/components/friends/request-list";
import { PlayerAvatar } from "@/components/player-avatar";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/format";
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
} from "@/lib/queries/friends";

export const metadata: Metadata = { title: "Friends · FIFA Tracker" };

export default async function FriendsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [friends, incoming, outgoing] = await Promise.all([
    getFriends(supabase),
    getIncomingRequests(supabase, user.id),
    getOutgoingRequests(supabase, user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        <p className="text-sm text-muted-foreground">
          You can only log matches against people on this list.
        </p>
      </div>

      <FriendSearch />

      {incoming.length > 0 && (
        <section aria-labelledby="requests-heading" className="space-y-3">
          <h2
            id="requests-heading"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            Requests
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {incoming.length}
            </span>
          </h2>
          <RequestList requests={incoming} />
        </section>
      )}

      <section aria-labelledby="friends-heading" className="space-y-3">
        <h2 id="friends-heading" className="text-sm font-semibold">
          {friends.length > 0
            ? `Your friends (${friends.length})`
            : "Your friends"}
        </h2>

        {friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No friends yet"
            description="Search for someone above by their username, or by the exact email they signed up with."
          />
        ) : (
          <FriendList friends={friends} />
        )}
      </section>

      {outgoing.length > 0 && (
        <section aria-labelledby="sent-heading" className="space-y-3">
          <h2
            id="sent-heading"
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
          >
            <Clock className="size-4" />
            Waiting on them
          </h2>
          <ul className="space-y-2">
            {outgoing.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border p-2.5"
              >
                <PlayerAvatar person={request.addressee} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {displayName(request.addressee)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{request.addressee.username}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Pending
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
