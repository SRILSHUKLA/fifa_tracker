"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GroupMemberSummary } from "@/types/database.types";

/**
 * Opponent selector, limited to the current group's members — which mirrors
 * the are_group_members() check the matches INSERT policy enforces in the
 * database.
 */
export function OpponentPicker({
  members,
  value,
  onChange,
}: {
  members: GroupMemberSummary[];
  value: string | null;
  onChange: (memberId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => members.find((member) => member.id === value) ?? null,
    [members, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Opponent"
          className="h-14 w-full justify-between px-3 font-normal"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <PlayerAvatar person={selected} size="sm" />
              <span className="truncate font-medium">
                {displayName(selected)}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2.5 text-muted-foreground">
              <span className="grid size-8 place-items-center rounded-full bg-secondary">
                <UserRound className="size-4" />
              </span>
              Choose an opponent
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search group..." className="h-11" />
          <CommandList className="max-h-72">
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.username} ${member.display_name ?? ""}`}
                  onSelect={() => {
                    onChange(member.id);
                    setOpen(false);
                  }}
                  className="gap-2.5"
                >
                  <Check
                    className={cn(
                      "size-4",
                      member.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <PlayerAvatar person={member} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {displayName(member)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{member.username}
                    </span>
                  </span>
                  {member.played > 0 && (
                    <span className="tnum shrink-0 text-xs text-muted-foreground">
                      {member.wins}-{member.draws}-{member.losses}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
