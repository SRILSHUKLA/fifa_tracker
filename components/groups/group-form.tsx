"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { createGroup } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Creates a group and drops the owner straight onto its detail page. */
export function GroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createGroup(name);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.group.name} created.`);
      router.push(`/groups/${result.group.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="group-name">Group name</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sunday League"
          maxLength={40}
          className="h-12"
          autoFocus
        />
      </div>

      <Button
        type="submit"
        disabled={pending || name.trim().length < 2}
        className="h-12 w-full text-base"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Create group
      </Button>
    </form>
  );
}
