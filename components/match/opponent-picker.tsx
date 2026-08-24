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
import type { FriendSummary } from "@/types/database.types";

/**
 * Opponent selector, limited to accepted friends — which mirrors the
 * are_friends() check the matches INSERT policy enforces in the database.
 */
export function OpponentPicker({
  friends,
  value,
  onChange,
}: {
  friends: FriendSummary[];
  value: string | null;
  onChange: (friendId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => friends.find((friend) => friend.id === value) ?? null,
    [friends, value],
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
          <CommandInput placeholder="Search friends..." className="h-11" />
          <CommandList className="max-h-72">
            <CommandEmpty>No friend found.</CommandEmpty>
            <CommandGroup>
              {friends.map((friend) => (
                <CommandItem
                  key={friend.id}
                  value={`${friend.username} ${friend.display_name ?? ""}`}
                  onSelect={() => {
                    onChange(friend.id);
                    setOpen(false);
                  }}
                  className="gap-2.5"
                >
                  <Check
                    className={cn(
                      "size-4",
                      friend.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <PlayerAvatar person={friend} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {displayName(friend)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{friend.username}
                    </span>
                  </span>
                  {friend.played > 0 && (
                    <span className="tnum shrink-0 text-xs text-muted-foreground">
                      {friend.wins}-{friend.draws}-{friend.losses}
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
