import { Image, Text, View } from "react-native";

type TeamLike = { name: string; logo_url?: string | null } | null;

const SIZES = {
  sm: 20,
  md: 28,
  lg: 44,
} as const;

/**
 * A team's crest, falling back to a generic circle when no team is picked,
 * or to the team's initials when a team is picked but has no logo (a
 * handful of the seeded ~165 teams have none).
 */
export function TeamBadge({
  team,
  size = "sm",
}: {
  team: TeamLike;
  size?: keyof typeof SIZES;
}) {
  const px = SIZES[size];

  if (!team) {
    return (
      <View
        className="shrink-0 items-center justify-center rounded-full bg-default"
        style={{ width: px, height: px }}
      >
        <View className="h-[40%] w-[55%] rounded-b-full border-2 border-muted" />
      </View>
    );
  }

  if (!team.logo_url) {
    return (
      <View
        accessibilityLabel={team.name}
        className="shrink-0 items-center justify-center rounded-full bg-default"
        style={{ width: px, height: px }}
      >
        <Text className="text-[9px] font-bold uppercase text-default-foreground">
          {team.name.slice(0, 2)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: team.logo_url }}
      accessibilityLabel={team.name}
      className="shrink-0"
      style={{ width: px, height: px, resizeMode: "contain" }}
    />
  );
}
