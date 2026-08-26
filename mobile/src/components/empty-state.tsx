import { Button } from "heroui-native";
import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";

type IconComponent = ComponentType<{
  size: number;
  color: string;
  strokeWidth?: number;
}>;

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
  icon: IconComponent;
  title: string;
  description: string;
  /** In-screen href for the fill-it action button. */
  action?: { href: string; label: string };
}) {
  const router = useRouter();

  return (
    <View className="items-center rounded-xl border border-dashed border-border px-6 py-12">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-default">
        <Icon size={22} color="#a1a1aa" strokeWidth={2} />
      </View>
      <Text className="mt-4 text-center font-semibold text-foreground">
        {title}
      </Text>
      <Text className="mt-1 max-w-[280px] text-center text-sm leading-5 text-muted">
        {description}
      </Text>
      {action && (
        <Button
          className="mt-5"
          size="sm"
          onPress={() => router.push(action.href as never)}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
}
