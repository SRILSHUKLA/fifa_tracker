"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { regenerateInviteCode } from "@/app/(app)/groups/actions";
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
 * Code display plus "copy code" / "copy link" buttons, so getting up to
 * eleven friends into a group is two taps each instead of typing a username.
 * The owner can also regenerate the code, which invalidates any link already
 * shared — that is destructive enough to sit behind a confirm dialog.
 */
export function InviteShare({
  groupId,
  inviteCode,
  isOwner,
}: {
  groupId: string;
  inviteCode: string;
  isOwner: boolean;
}) {
  const [code, setCode] = useState(inviteCode);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateInviteCode(groupId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setCode(result.code);
      setOpen(false);
      toast.success("New invite code generated. The old link no longer works.");
    });
  }

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/groups/join/${code}`
      : `/groups/join/${code}`;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-lg font-semibold tracking-widest">
          {code}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => copy(code, "Code")}
        >
          <Copy className="size-3.5" />
          Copy code
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => copy(inviteLink, "Invite link")}
        >
          <Check className="size-4" />
          Copy invite link
        </Button>

        {isOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="Regenerate invite code"
              >
                <RefreshCw className="size-4" />
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-xs rounded-xl">
              <DialogHeader>
                <DialogTitle>Regenerate the invite code?</DialogTitle>
                <DialogDescription>
                  Anyone with the current code or link will no longer be able
                  to join. Members already in the group are not affected.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2 sm:gap-2">
                <DialogClose asChild>
                  <Button variant="secondary" className="flex-1">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={pending}
                  onClick={regenerate}
                  className="flex-1"
                >
                  Regenerate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
