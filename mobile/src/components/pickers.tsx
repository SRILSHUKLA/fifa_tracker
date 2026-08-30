import { BottomSheet, SearchField } from "heroui-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { PlayerAvatar } from "./player-avatar";
import { TeamBadge } from "./team-badge";
import { displayName } from "@/lib/format";
import { groupByLeague, teamLabel } from "@/lib/queries/teams";
import type { GroupMemberSummary, Team } from "@/types/database.types";

/**
 * Shared shell for the two "search and pick" sheets (opponent + team).
 * A HeroUI Native BottomSheet keeps the picker thumb-reachable — on a phone
 * a modal list beats the web app's popovers.
 */
function SearchableSheet<T>({
  isOpen,
  onOpenChange,
  title,
  placeholder,
  items,
  keyOf,
  searchOf,
  renderItem,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  items: T[];
  keyOf: (item: T) => string;
  searchOf: (item: T) => string;
  renderItem: (item: T, close: () => void) => React.ReactElement | null;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => searchOf(item).toLowerCase().includes(q));
  }, [items, query, searchOf]);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Content snapPoints={["70%"]} enablePanDownToClose>
          <View className="flex-1 px-4 pb-8 pt-1">
            <Text className="mb-3 text-base font-semibold text-foreground">
              {title}
            </Text>

            <SearchField value={query} onChange={setQuery}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={placeholder}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {!!query && <SearchField.ClearButton />}
              </SearchField.Group>
            </SearchField>

            <FlatList
              className="mt-2 flex-1"
              data={filtered}
              keyExtractor={(item) => keyOf(item)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text className="py-6 text-center text-sm text-muted">
                  Nothing matches “{query}”.
                </Text>
              }
              renderItem={({ item }) =>
                renderItem(item, () => onOpenChange(false)) as React.ReactElement
              }
            />
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Opponent picker                                                     */
/* ------------------------------------------------------------------ */

export function OpponentPicker({
  members,
  value,
  onChange,
}: {
  members: GroupMemberSummary[];
  value: string | null;
  onChange: (memberId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = members.find((m) => m.id === value) ?? null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose opponent"
        onPress={() => setIsOpen(true)}
        className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3 active:opacity-60"
      >
        {selected ? (
          <>
            <PlayerAvatar person={selected} size="md" />
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-medium text-foreground"
            >
              {displayName(selected)}
            </Text>
          </>
        ) : (
          <>
            <View className="h-10 w-10 items-center justify-center rounded-full border border-dashed border-border">
              <Text className="text-muted">?</Text>
            </View>
            <Text numberOfLines={1} className="min-w-0 flex-1 text-muted">
              Who are you playing?
            </Text>
          </>
        )}
        <Text className="shrink-0 text-lg text-muted">›</Text>
      </Pressable>

      <SearchableSheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title="Choose your opponent"
        placeholder="Search players…"
        items={members}
        keyOf={(m) => m.id}
        searchOf={(m) => `${displayName(m)} ${m.username}`}
        renderItem={(member, close) => (
          <Pressable
            onPress={() => {
              onChange(member.id);
              close();
            }}
            className="flex-row items-center gap-3 rounded-xl px-1 py-2.5 active:opacity-60"
          >
            <PlayerAvatar person={member} size="sm" highlight={member.id === value} />
            <Text
              numberOfLines={1}
              className={`min-w-0 flex-1 text-[15px] ${
                member.id === value ? "font-semibold text-accent" : "text-foreground"
              }`}
            >
              {displayName(member)}
            </Text>
            {member.role === "owner" && (
              <Text className="shrink-0 text-xs text-accent">owner</Text>
            )}
          </Pressable>
        )}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Team picker                                                         */
/* ------------------------------------------------------------------ */

type TeamRow =
  | { kind: "header"; key: string; name: string }
  | { kind: "team"; key: string; team: Team };

/**
 * Groups teams by league (in LEAGUE_ORDER) into one flat searchable list
 * with sticky-ish headers, mirroring the web app's grouped combobox.
 */
function buildTeamRows(teams: Team[]): TeamRow[] {
  const rows: TeamRow[] = [];
  for (const [leagueName, leagueTeams] of groupByLeague(teams)) {
    rows.push({ kind: "header", key: `h:${leagueName}`, name: leagueName });
    for (const team of leagueTeams) {
      rows.push({ kind: "team", key: `t:${team.id}`, team });
    }
  }
  return rows;
}

export function TeamPicker({
  teams,
  value,
  onChange,
  label = "Your team",
  clearable = false,
}: {
  teams: Team[];
  value: number | null;
  onChange: (teamId: number | null) => void;
  label?: string;
  /** Adds a "No team" row so a choice can be undone (match logging). */
  clearable?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = teams.find((t) => t.id === value) ?? null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label}`}
        onPress={() => setIsOpen(true)}
        className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3 active:opacity-60"
      >
        {selected ? (
          <>
            <TeamBadge team={selected} size="md" />
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-medium text-foreground"
            >
              {teamLabel(selected)}
            </Text>
          </>
        ) : (
          <>
            <TeamBadge team={null} size="md" />
            <Text numberOfLines={1} className="min-w-0 flex-1 text-muted">
              Pick a team
            </Text>
          </>
        )}
        <Text className="shrink-0 text-lg text-muted">›</Text>
      </Pressable>

      <SearchableSheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={`Choose ${label.toLowerCase()}`}
        placeholder="Search teams…"
        items={buildTeamRows(teams)}
        keyOf={(row) => row.key}
        searchOf={(row) =>
          row.kind === "header"
            ? row.name
            : `${row.team.name} ${row.team.short_name ?? ""}`
        }
        renderItem={(row, close) =>
          row.kind === "header" ? (
            <Text
              key={row.key}
              className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              {row.name}
            </Text>
          ) : (
            <Pressable
              key={row.key}
              onPress={() => {
                onChange(row.team.id);
                close();
              }}
              className="flex-row items-center gap-3 rounded-xl px-1 py-2.5 active:opacity-60"
            >
              <TeamBadge team={row.team} size="sm" />
              <Text
                numberOfLines={1}
                className={`min-w-0 flex-1 text-[15px] ${
                  row.team.id === value
                    ? "font-semibold text-accent"
                    : "text-foreground"
                }`}
              >
                {teamLabel(row.team)}
              </Text>
              {row.team.id === value && (
                <Text className="shrink-0 text-xs font-medium text-accent">✓</Text>
              )}
            </Pressable>
          )
        }
      />

      {clearable && selected && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(null)}
          className="mt-1 self-start rounded-md px-1 py-1 active:opacity-60"
        >
          <Text className="text-xs text-muted">Clear selection</Text>
        </Pressable>
      )}
    </>
  );
}
