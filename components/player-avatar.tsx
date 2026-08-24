import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { displayName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Person = {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-base",
} as const;

export function PlayerAvatar({
  person,
  size = "md",
  className,
  highlight = false,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  className?: string;
  /** Ring the avatar in red — used for the signed-in user. */
  highlight?: boolean;
}) {
  const name = displayName(person);

  return (
    <Avatar
      className={cn(
        SIZES[size],
        highlight && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {person.avatar_url && <AvatarImage src={person.avatar_url} alt={name} />}
      <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
