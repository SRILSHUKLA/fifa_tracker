"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";

import { unfriend } from "@/app/(app)/friends/actions";
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

export function UnfriendButton({
  friendId,
  username,
}: {
  friendId: string;
  username: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await unfriend(friendId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(`Removed @${username}.`);
      router.push("/friends");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${username}`}
          className="text-muted-foreground"
        >
          <UserMinus className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xs rounded-xl">
        <DialogHeader>
          <DialogTitle>Remove @{username}?</DialogTitle>
          <DialogDescription>
            You will not be able to log matches against each other until one of
            you sends a new request. Matches you have already played stay on the
            leaderboard.
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
