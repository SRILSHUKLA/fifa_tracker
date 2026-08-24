"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { leaveGroupAction } from "@/app/(app)/groups/actions";
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

/**
 * Leaves a group. Past matches are deliberately kept: deleting them would
 * silently rewrite this group's leaderboard for everyone else still in it.
 * The owner cannot leave (the server rejects it), so this is only rendered
 * for non-owner members.
 */
export function LeaveGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await leaveGroupAction(groupId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(`Left ${groupName}.`);
      router.push("/groups");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <LogOut className="size-4" />
          Leave group
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xs rounded-xl">
        <DialogHeader>
          <DialogTitle>Leave {groupName}?</DialogTitle>
          <DialogDescription>
            You will no longer see this group&apos;s matches or leaderboard,
            and you cannot log matches against its members until you rejoin.
            Matches already played stay on the group&apos;s leaderboard for
            everyone else.
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
            Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
