import { ChevronDown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useActiveGroup } from "@/lib/active-group";
import { BottomSheet } from "heroui-native";
import { useState } from "react";

/**
 * The mobile take on the web app's GroupSwitcher popover: a compact chip in
 * each scoped tab's header area that opens a bottom sheet listing every
 * group. Only rendered when there is more than one group to pick from.
 */
export function GroupSwitcherChip() {
  const { group, groups, setActiveGroup } = useActiveGroup();
  const [isOpen, setIsOpen] = useState(false);

  if (!group || (groups?.length ?? 0) < 2) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Active group: ${group.name}. Switch group`}
        onPress={() => setIsOpen(true)}
        className="flex-row items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 active:opacity-60"
      >
        <Text
          numberOfLines={1}
          className="max-w-[160px] text-xs font-medium text-foreground"
        >
          {group.name}
        </Text>
        <ChevronDown size={14} color="#a1a1aa" strokeWidth={2} />
      </Pressable>

      <BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Content snapPoints={["45%"]} enablePanDownToClose>
            <View className="px-4 pb-8">
              <Text className="mb-2 text-base font-semibold text-foreground">
                Switch group
              </Text>

              {groups.map(({ group: g, role }) => {
                const isActive = g.id === group.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      setActiveGroup(g.id);
                      setIsOpen(false);
                    }}
                    className="flex-row items-center justify-between rounded-xl px-1 py-3 active:opacity-60"
                  >
                    <Text
                      numberOfLines={1}
                      className={`min-w-0 flex-1 pr-2 text-[15px] ${
                        isActive ? "font-semibold text-accent" : "text-foreground"
                      }`}
                    >
                      {g.name}
                    </Text>
                    <Text className="shrink-0 text-xs text-muted">
                      {role === "owner" ? "Owner" : "Member"}
                    </Text>
                    {isActive && (
                      <Text className="ml-2 shrink-0 text-xs font-medium text-accent">
                        ✓
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
}

/**
 * Header row used by scoped tabs: title/subtitle on the left and the group
 * chip on the right when applicable.
 */
export function ScopedHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { group } = useActiveGroup();

  return (
    <View className="mb-5 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[26px] leading-8 font-bold tracking-tight text-foreground">
          {title}
        </Text>
        {subtitle && (
          <Text className="mt-0.5 text-sm leading-5 text-muted">{subtitle}</Text>
        )}
      </View>
      {group && (
        <View className="mt-1.5 shrink-0">
          <GroupSwitcherChip />
        </View>
      )}
    </View>
  );
}
