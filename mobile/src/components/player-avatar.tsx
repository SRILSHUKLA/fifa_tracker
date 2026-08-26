import { Avatar } from "heroui-native";
import { Text } from "react-native";

import { displayName, initials } from "@/lib/format";

type Person = {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

const SIZES = {
  sm: { avatar: 32, text: "text-[11px]" },
  md: { avatar: 40, text: "text-xs" },
  lg: { avatar: 56, text: "text-base" },
} as const;

/**
 * A person's avatar with an initials fallback. The signed-in user is ringed
 * in brand red (`highlight`) — same convention as the web app.
 */
export function PlayerAvatar({
  person,
  size = "md",
  highlight = false,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  highlight?: boolean;
}) {
  const name = displayName(person);
  const dims = SIZES[size];

  return (
    <Avatar
      size="sm"
      className="bg-default"
      style={{
        width: dims.avatar,
        height: dims.avatar,
        borderWidth: highlight ? 2 : 0,
        borderColor: highlight ? "#e2402f" : undefined,
      }}
    >
      <Avatar.Fallback className="bg-default">
        <Text
          className={`font-semibold text-default-foreground ${dims.text}`}
        >
          {initials(name)}
        </Text>
      </Avatar.Fallback>
    </Avatar>
  );
}
