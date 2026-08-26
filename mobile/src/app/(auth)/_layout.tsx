import { Redirect, Stack } from "expo-router";
import type { JSX } from "react";
import { View } from "react-native";

import { useAuth } from "@/lib/auth";

/** Auth shell: centered card under a soft red radial glow (web parity).
 * Signed-in users never see it. */
export default function AuthLayout(): JSX.Element {
  const { session, isLoading } = useAuth();

  if (!isLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View className="flex-1 bg-background">
      {/* Soft radial glow behind the card */}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-80 opacity-[0.14]"
        style={{
          backgroundColor: "#e2402f",
          borderBottomLeftRadius: 160,
          borderBottomRightRadius: 160,
          transform: [{ scaleX: 1.6 }],
        }}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </View>
  );
}
