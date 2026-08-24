import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { JoinGroupForm } from "@/components/groups/join-group-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a group · FIFA Tracker" };

export default async function JoinGroupPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Join a group</h1>
        <p className="text-sm text-muted-foreground">
          Enter the code someone shared with you, or open the invite link
          they sent instead.
        </p>
      </div>

      <JoinGroupForm />
    </div>
  );
}
