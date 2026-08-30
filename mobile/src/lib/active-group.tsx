import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useQuery } from "@tanstack/react-query";

import { getMyGroups } from "./queries/groups";
import { useAuth } from "./auth";

const STORAGE_KEY = "active_group_id";

type GroupRow = {
  id: string;
  name: string;
  owner_id: string;
};

type ActiveGroupContextValue = {
  /** The resolved active group (never null while the user has groups). */
  group: GroupRow | null;
  groups: Awaited<ReturnType<typeof getMyGroups>>;
  isLoading: boolean;
  setActiveGroup: (groupId: string) => Promise<void>;
};

const ActiveGroupContext = createContext<ActiveGroupContextValue | null>(null);

export function useActiveGroup() {
  const ctx = useContext(ActiveGroupContext);
  if (!ctx) {
    throw new Error("useActiveGroup must be used within <ActiveGroupProvider>");
  }
  return ctx;
}

/**
 * The mobile equivalent of the web app's active-group cookie: the picked
 * group persists in AsyncStorage and drives Home / Table / History.
 * Resolution mirrors lib/groups/active-group.ts — none → onboarding states,
 * one → always it, otherwise the stored pick if still valid, else the most
 * recently joined group. The invalid-pick fallback is derived at render
 * time rather than synced into state, so a stale id self-heals without
 * cascading renders.
 */
export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [storedId, setStoredId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!cancelled) {
          setStoredId(value);
          setStorageLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setStorageLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups", userId],
    queryFn: () => getMyGroups(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const activeGroup = useMemo<GroupRow | null>(() => {
    if (!groups || groups.length === 0) return null;
    if (
      storedId &&
      groups.some((membership) => membership.group.id === storedId)
    ) {
      return groups.find((m) => m.group.id === storedId)!.group;
    }
    // Most recently joined wins when nothing (valid) is stored.
    return groups[0].group;
  }, [groups, storedId]);

  const setActiveGroup = useCallback(async (groupId: string) => {
    setStoredId(groupId);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, groupId);
    } catch {
      // Storage failure is non-fatal — resolution falls back to most recent.
    }
  }, []);

  const value = useMemo(
    () => ({
      group: activeGroup,
      groups,
      isLoading: groupsLoading || (!!userId && !storageLoaded),
      setActiveGroup,
    }),
    [activeGroup, groups, groupsLoading, userId, storageLoaded, setActiveGroup],
  );

  return (
    <ActiveGroupContext.Provider value={value}>
      {children}
    </ActiveGroupContext.Provider>
  );
}
