import { Badge } from "@/components/ui/badge";
import type { LeagueStatus } from "@/types/database.types";

const STATUS: Record<
  LeagueStatus,
  { label: string; variant: "outline" | "default" | "secondary" }
> = {
  draft: { label: "Open to join", variant: "outline" },
  in_progress: { label: "In progress", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
};

export function LeagueStatusBadge({
  status,
  className,
}: {
  status: LeagueStatus;
  className?: string;
}) {
  const { label, variant } = STATUS[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
