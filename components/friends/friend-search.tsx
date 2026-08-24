"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Clock, LoaderCircle, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { addFriend, searchPeople } from "@/app/(app)/friends/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName } from "@/lib/format";
import type { UserSearchResult } from "@/types/database.types";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

type SearchState = { query: string; items: UserSearchResult[] };

/**
 * Find-a-friend box. Searches on a username prefix or an exact email.
 *
 * Results are debounced rather than fetched per keystroke — on mobile data, a
 * request for every character is both slow and wasteful. Results are stored
 * alongside the query that produced them, so "still searching" and "stale
 * results" are derived rather than tracked in their own state, and a slow
 * early response can never overwrite a fast later one.
 */
export function FriendSearch() {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<SearchState>({ query: "", items: [] });
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY;
  const settled = found.query === trimmed;

  const results = !tooShort && settled ? found.items : [];
  const searching = !tooShort && !settled;

  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(async () => {
      const items = await searchPeople(trimmed);
      setFound({ query: trimmed, items });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, tooShort]);

  function handleAdd(person: UserSearchResult) {
    startTransition(async () => {
      const result = await addFriend(person.id);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setSent((previous) => new Set(previous).add(person.id));
      toast.success(`Request sent to @${person.username}.`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Username or exact email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search for people"
          className="h-11 pl-9 text-base"
        />
        {searching && (
          <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {!tooShort && settled && results.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">
          Nobody found. Usernames match from the start; emails must be exact.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
            >
              <PlayerAvatar person={person} size="md" />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">
                  {displayName(person)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{person.username}
                </p>
              </div>

              <SearchResultAction
                person={person}
                justSent={sent.has(person.id)}
                onAdd={() => handleAdd(person)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchResultAction({
  person,
  justSent,
  onAdd,
}: {
  person: UserSearchResult;
  justSent: boolean;
  onAdd: () => void;
}) {
  if (person.friendship_status === "accepted") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5" />
        Friends
      </span>
    );
  }

  if (person.friendship_status === "pending" || justSent) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        {person.is_requester || justSent ? "Sent" : "Wants to add you"}
      </span>
    );
  }

  if (person.friendship_status === "blocked") return null;

  return (
    <Button size="sm" onClick={onAdd} className="shrink-0">
      <UserPlus className="size-4" />
      Add
    </Button>
  );
}
