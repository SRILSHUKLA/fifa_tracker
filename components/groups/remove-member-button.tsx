"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";

import { removeMember } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Owner-only. Past matches are kept: removing someone does not touch history. */
export function RemoveMemberButton({
  groupId,
  memberId,
  username,
}: {
  groupId: string;
  memberId: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await removeMember(groupId, memberId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(`Removed @${username}.`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${username}`}
          className="size-8 text-muted-foreground"
        >
          <UserMinus className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xs rounded-xl">
        <DialogHeader>
          <DialogTitle>Remove @{username}?</DialogTitle>
          <DialogDescription>
            They will no longer see this group&apos;s matches or leaderboard,
            and cannot log matches against its members until they rejoin.
            Matches already played stay on the leaderboard for everyone else.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button variant="secondary" className="flex-1">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={confirm}
            className="flex-1"
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
