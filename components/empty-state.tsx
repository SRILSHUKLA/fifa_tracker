import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown wherever a list is legitimately empty. Always offers the one action
 * that would fill it, so a new account is never a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button asChild className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
