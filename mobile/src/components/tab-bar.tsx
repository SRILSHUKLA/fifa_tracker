import { Home, Medal, Plus, Trophy, UsersRound } from "lucide-react-native";
import type { ComponentType } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconComponent = ComponentType<{ size: number; color: string; strokeWidth?: number }>;

const TABS: { name: string; label: string; icon: IconComponent }[] = [
  { name: "index", label: "Home", icon: Home },
  { name: "leaderboard", label: "Table", icon: Trophy },
  { name: "groups", label: "Groups", icon: UsersRound },
  { name: "leagues", label: "Leagues", icon: Medal },
];

/**
 * Fixed bottom tab bar with a raised "log match" button in the middle.
 * Everything sits at the bottom of the screen because that is where a thumb
 * is when you are holding a phone in one hand and a controller in the other.
 */
export function TabBar({
  activeTab,
  onSelectTab,
  onLogMatch,
}: {
  activeTab: string;
  onSelectTab: (name: string) => void;
  onLogMatch: () => void;
}) {
  const insets = useSafeAreaInsets();
  const paddingBottom =
    Platform.OS === "ios" ? Math.max(insets.bottom, 8) : insets.bottom;

  return (
    <View
      className="absolute inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95"
      style={{ paddingBottom }}
    >
      <View className="flex-row items-end px-2">
        {TABS.slice(0, 2).map((tab) => (
          <NavTab
            key={tab.name}
            {...tab}
            active={activeTab === tab.name}
            onPress={() => onSelectTab(tab.name)}
          />
        ))}

        <View className="w-14 items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log a match"
            onPress={onLogMatch}
            className="-mt-6 h-14 w-14 items-center justify-center rounded-full bg-accent"
            style={{
              shadowColor: "#e2402f",
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Plus size={26} color="#fcfcfc" strokeWidth={2.5} />
          </Pressable>
        </View>

        {TABS.slice(2).map((tab) => (
          <NavTab
            key={tab.name}
            {...tab}
            active={activeTab === tab.name}
            onPress={() => onSelectTab(tab.name)}
          />
        ))}
      </View>
    </View>
  );
}

function NavTab({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconComponent;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? "#e2402f" : "#a1a1aa";

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-14 flex-1 flex-col items-center justify-center gap-1 active:opacity-60"
    >
      <Icon size={20} color={color} strokeWidth={active ? 2.25 : 2} />
      <Text
        className={`text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
