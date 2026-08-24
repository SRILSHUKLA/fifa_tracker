"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { setActiveGroup } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { MyGroup } from "@/lib/queries/groups";

/**
 * Only rendered by the layout when the user belongs to more than one group —
 * with 0 or 1 groups there is nothing to switch between. Picking a group
 * writes the active_group_id cookie via a server action; that action already
 * revalidates the tree, so no client-side refresh is needed here.
 */
export function GroupSwitcher({
  groups,
  activeGroupId,
}: {
  groups: MyGroup[];
  activeGroupId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function select(groupId: string) {
    setOpen(false);
    if (groupId === activeGroupId) return;
    startTransition(() => {
      setActiveGroup(groupId);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="max-w-48 justify-between gap-2 font-normal"
        >
          <span className="truncate">
            {groups.find((g) => g.group.id === activeGroupId)?.group.name ??
              "Choose a group"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-1">
        {groups.map(({ group }) => (
          <button
            key={group.id}
            type="button"
            onClick={() => select(group.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            <Check
              className={cn(
                "size-4 shrink-0",
                group.id === activeGroupId ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="truncate">{group.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
