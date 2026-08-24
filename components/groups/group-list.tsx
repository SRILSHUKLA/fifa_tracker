import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";

import type { MyGroup } from "@/lib/queries/groups";

/** Every group the current user belongs to. Tapping through opens the group. */
export function GroupList({ groups }: { groups: MyGroup[] }) {
  return (
    <ul className="space-y-2">
      {groups.map(({ group, role }) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-opacity active:opacity-70"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium leading-tight">
                {group.name}
                {role === "owner" && (
                  <Crown className="size-3.5 shrink-0 text-primary" />
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {role === "owner" ? "You own this group" : "Member"}
              </p>
            </div>

            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
