import { Tabs, useRouter } from "expo-router";
import type { JSX } from "react";

import { TabBar } from "@/components/tab-bar";
import { useAuth, useRequireAuth } from "@/lib/auth";

/** Auth-gated shell: four tabs plus the raised log-match FAB. */
export default function TabsLayout(): JSX.Element | null {
  const router = useRouter();
  const { isLoading } = useAuth();
  const { session } = useRequireAuth();

  if (!isLoading && !session) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => {
        const routeName =
          props.state.routes[props.state.index]?.name ?? "index";
        return (
          <TabBar
            activeTab={routeName}
            onSelectTab={(name) => props.navigation.navigate(name as never)}
            onLogMatch={() => router.push("/match/new")}
          />
        );
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="leagues" />
    </Tabs>
  );
}
