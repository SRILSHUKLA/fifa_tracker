import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GroupForm } from "@/components/groups/group-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a group · FIFA Tracker" };

export default async function NewGroupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
        <h1 className="text-2xl font-bold tracking-tight">Create a group</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ll get an invite code and link to share with up to 11
          friends.
        </p>
      </div>

      <GroupForm />
    </div>
  );
}
