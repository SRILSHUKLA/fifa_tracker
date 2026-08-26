import { Avatar } from "heroui-native";
import { LogOut } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Brand } from "./brand";
import { displayName, initials } from "@/lib/format";
import type { Profile } from "@/types/database.types";

/**
 * The tab screens' shared header: brand wordmark on the left; avatar (into
 * /history) and sign-out on the right. Same anatomy as the web app's
 * sticky header.
 */
export function AppHeader({
  profile,
  onAvatarPress,
  onSignOut,
}: {
  profile: Profile;
  onAvatarPress: () => void;
  onSignOut: () => void;
}) {
  const name = displayName(profile);

  return (
    <View className="border-b border-border/80 bg-background/95">
      <View className="h-14 flex-row items-center justify-between gap-3 px-4">
        <Brand size="sm" />

        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your stats and match history"
            onPress={onAvatarPress}
            className="rounded-full p-0.5 active:opacity-60"
          >
            <Avatar size="sm" className="bg-default">
              <Avatar.Fallback className="bg-default">
                <Text className="text-xs font-semibold text-default-foreground">
                  {initials(name)}
                </Text>
              </Avatar.Fallback>
            </Avatar>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={onSignOut}
            hitSlop={8}
            className="rounded-lg p-2 active:opacity-60"
          >
            <LogOut size={18} className="text-muted" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
