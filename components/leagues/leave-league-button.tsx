"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { toast } from "sonner";

import { leaveLeagueAction } from "@/app/(app)/leagues/actions";
import { Button } from "@/components/ui/button";

/**
 * Only rendered for a league still in `draft` — RLS only allows leaving
 * before the league starts (fixtures already reference a participant once
 * it does). No confirmation dialog: unlike leaving a group, this is fully
 * reversible by just joining again while the league is still open.
 */
export function LeaveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleLeave() {
    startTransition(async () => {
      await leaveLeagueAction(leagueId);
      toast.success("Left the league.");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLeave}
      disabled={pending}
      className="text-muted-foreground"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      Leave league
    </Button>
  );
}
