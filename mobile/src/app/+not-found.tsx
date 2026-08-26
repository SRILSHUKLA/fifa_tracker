import { useRouter } from "expo-router";
import { Flag } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

/** 404 — "That page went wide of the post." */
export default function NotFoundScreen(): JSX.Element {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-default">
        <Flag size={22} color="#a1a1aa" strokeWidth={2} />
      </View>
      <Text className="mt-4 text-lg font-semibold text-foreground">
        That page went wide of the post.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/")}
        className="mt-5 rounded-xl bg-accent px-5 py-3 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-accent-foreground">
          Back home
        </Text>
      </Pressable>
    </View>
  );
}
