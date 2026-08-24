"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { joinGroup } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Joins a group by invite code. `defaultCode` prefills the field when this
 * form is reached via a shared /groups/join/[code] link, so tapping the link
 * and confirming is the whole flow.
 */
export function JoinGroupForm({ defaultCode }: { defaultCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(defaultCode ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result = await joinGroup(code);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`You joined ${result.group.name}.`);
      router.push(`/groups/${result.group.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABCD1234"
          maxLength={8}
          className="h-12 font-mono uppercase tracking-widest"
          autoFocus={!defaultCode}
        />
      </div>

      <Button
        type="submit"
        disabled={pending || code.trim().length === 0}
        className="h-12 w-full text-base"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Join group
      </Button>
    </form>
  );
}
