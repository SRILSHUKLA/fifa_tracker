"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { renameGroup } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Owner-only rename. */
export function RenameGroupDialog({
  groupId,
  currentName,
}: {
  groupId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result = await renameGroup(groupId, name);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Group renamed.");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName(currentName);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Rename group"
          className="size-8 text-muted-foreground"
        >
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xs rounded-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Label htmlFor="rename-group">Group name</Label>
            <Input
              id="rename-group"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              className="h-11"
              autoFocus
            />
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="flex-1">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || name.trim().length < 2}
              className="flex-1"
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
