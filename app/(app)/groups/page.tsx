import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Plus, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { GroupList } from "@/components/groups/group-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/queries/groups";

export const metadata: Metadata = { title: "Groups · Bragging Rights" };

export default async function GroupsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const groups = await getMyGroups(supabase, user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <p className="text-sm text-muted-foreground">
          You can only log matches, and see stats, against people who share a
          group with you.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12">
          <Link href="/groups/new">
            <Plus className="size-4" />
            Create
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <Link href="/groups/join">
            <KeyRound className="size-4" />
            Join
          </Link>
        </Button>
      </div>

      <section aria-labelledby="groups-heading" className="space-y-3">
        <h2 id="groups-heading" className="text-sm font-semibold">
          {groups.length > 0 ? `Your groups (${groups.length})` : "Your groups"}
        </h2>

        {groups.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No groups yet"
            description="Create a group and share the invite code or link, or join one someone shared with you."
          />
        ) : (
          <GroupList groups={groups} />
        )}
      </section>
    </div>
  );
}
