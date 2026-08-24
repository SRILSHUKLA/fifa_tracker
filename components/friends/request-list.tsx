"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { answerRequest } from "@/app/(app)/friends/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/format";
import type { PendingRequest } from "@/lib/queries/friends";

/** Incoming friend requests, each with accept and decline in one tap. */
export function RequestList({ requests }: { requests: PendingRequest[] }) {
  const [pending, startTransition] = useTransition();

  function answer(request: PendingRequest, accept: boolean) {
    startTransition(async () => {
      const result = await answerRequest(request.id, accept);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        accept
          ? `You and @${request.requester.username} are now friends.`
          : `Declined @${request.requester.username}.`,
      );
    });
  }

  return (
    <ul className="space-y-2">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-2.5"
        >
          <PlayerAvatar person={request.requester} size="md" />

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">
              {displayName(request.requester)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{request.requester.username}
            </p>
          </div>

          <div className="flex shrink-0 gap-1.5">
            <Button
              size="icon"
              aria-label={`Accept ${request.requester.username}`}
              disabled={pending}
              onClick={() => answer(request, true)}
              className="size-9"
            >
              <Check className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              aria-label={`Decline ${request.requester.username}`}
              disabled={pending}
              onClick={() => answer(request, false)}
              className="size-9"
            >
              <X className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
