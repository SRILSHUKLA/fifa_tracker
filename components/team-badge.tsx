import { Shield } from "lucide-react";

import { cn } from "@/lib/utils";

type TeamLike = { name: string; logo_url?: string | null } | null;

const SIZES = {
  sm: "size-5",
  md: "size-7",
  lg: "size-11",
} as const;

/**
 * A team's crest, falling back to a generic shield when no team is picked,
 * or to the team's initials when a team is picked but has no logo_url (a
 * handful of the seeded ~165 teams didn't resolve confidently against
 * TheSportsDB — see scripts/fetch-team-logos.mjs).
 *
 * Plain `<img>`, not next/image: these are small, already-compressed crests
 * hotlinked from TheSportsDB's own CDN, so there is nothing for Next's image
 * pipeline to usefully optimize, and it would add an external remote-image
 * config for no real benefit here.
 */
export function TeamBadge({
  team,
  size = "sm",
  className,
}: {
  team: TeamLike;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!team) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground",
          SIZES[size],
          className,
        )}
      >
        <Shield className="size-3/5" strokeWidth={1.75} />
      </span>
    );
  }

  if (!team.logo_url) {
    return (
      <span
        title={team.name}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-bold uppercase text-secondary-foreground",
          SIZES[size],
          className,
        )}
      >
        {team.name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.logo_url}
      alt={team.name}
      title={team.name}
      loading="lazy"
      className={cn("shrink-0 object-contain", SIZES[size], className)}
    />
  );
}
