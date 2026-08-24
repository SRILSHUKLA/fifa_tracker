import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { JoinGroupForm } from "@/components/groups/join-group-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a group · FIFA Tracker" };

/**
 * Target of a shared invite link (`/groups/join/[code]`). Prefills the code
 * so opening the link and tapping "Join" is the whole flow — the actual join
 * still goes through the same joinGroup server action as the manual-entry
 * form, so it gets the same validation and full-group handling for free.
 */
export default async function JoinGroupByCodePage({
  params,
}: PageProps<"/groups/join/[code]">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { code } = await params;

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
      >
        <Link href="/groups">
          <ArrowLeft className="size-4" />
          Groups
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Join a group</h1>
        <p className="text-sm text-muted-foreground">
          Confirm below to join with the invite code from your link.
        </p>
      </div>

      <JoinGroupForm defaultCode={decodeURIComponent(code).toUpperCase()} />
    </div>
  );
}
