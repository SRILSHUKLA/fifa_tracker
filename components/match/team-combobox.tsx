"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Shirt } from "lucide-react";

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
import { groupByLeague } from "@/lib/queries/teams";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/database.types";

/**
 * Searchable, league-grouped team picker.
 *
 * The full team list (~160 rows, a few KB) is fetched once by the page and
 * filtered in memory here, so typing never hits the network.
 */
export function TeamCombobox({
  teams,
  value,
  onChange,
  label,
}: {
  teams: Team[];
  value: number | null;
  onChange: (teamId: number | null) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => teams.find((team) => team.id === value) ?? null,
    [teams, value],
  );

  const groups = useMemo(() => groupByLeague(teams), [teams]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="h-11 w-full justify-between px-3 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Shirt className="size-4 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "truncate",
                !selected && "text-muted-foreground",
              )}
            >
              {selected ? selected.name : "Pick a team"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search teams..." className="h-11" />
          <CommandList className="max-h-72">
            <CommandEmpty>No team found.</CommandEmpty>

            {selected && (
              <CommandGroup>
                <CommandItem
                  value="__clear__ clear selection"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}

            {groups.map(([league, leagueTeams]) => (
              <CommandGroup key={league} heading={league}>
                {leagueTeams.map((team) => (
                  <CommandItem
                    // The searchable string: name, code and country all match.
                    value={`${team.name} ${team.short_name ?? ""} ${team.country ?? ""}`}
                    key={team.id}
                    onSelect={() => {
                      onChange(team.id === value ? null : team.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        team.id === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{team.name}</span>
                    {team.short_name && (
                      <span className="text-xs text-muted-foreground">
                        {team.short_name}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
