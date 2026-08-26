import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider, useToast } from "heroui-native";
import { StatusBar } from "expo-status-bar";
import type { JSX } from "react";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";

import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";

import { ActiveGroupProvider } from "@/lib/active-group";
import { AuthProvider } from "@/lib/auth";
import { setToastManager } from "@/lib/toast";

import "../global.css";

void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Captures the toast manager into a module singleton for lib/toast. */
function ToastBridge() {
  const { toast: manager } = useToast();

  useEffect(() => {
    setToastManager(manager);
  }, [manager]);

  return null;
}

export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  // Bragging Rights is dark-only — used at night, next to a TV.
  useEffect(() => {
    Uniwind.setTheme("dark");
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <HeroUINativeProvider>
          <ToastBridge />
          <SafeAreaProvider>
            <AuthProvider>
              <ActiveGroupProvider>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#0a0a0b" },
                  }}
                >
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="match/new"
                    options={{ presentation: "modal", animationDuration: 250 }}
                  />
                  <Stack.Screen
                    name="match/edit"
                    options={{ presentation: "modal" }}
                  />
                  <Stack.Screen name="history" />
                  <Stack.Screen name="groups/new" />
                  <Stack.Screen name="groups/join" />
                  <Stack.Screen name="groups/join/[code]" />
                  <Stack.Screen name="groups/[groupId]" />
                  <Stack.Screen name="groups/[groupId]/members/[username]" />
                  <Stack.Screen name="leagues/new" />
                  <Stack.Screen name="leagues/[leagueId]" />
                </Stack>
              </ActiveGroupProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </HeroUINativeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
