import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "./supabase";
import { getProfile } from "./queries/stats";
import type { Profile } from "@/types/database.types";

type Session = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>["data"]["session"];

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** True until the first session/profile resolution settles. */
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * Owns the Supabase session + the signed-in user's profile row. Screens
 * gate on `session` and render off `profile`, mirroring the web app's
 * (app)/layout guard.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    mounted.current = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted.current) return;
        setSession(data.session);

        if (data.session) {
          const me = await getProfile(data.session.user.id);
          if (!mounted.current) return;
          setProfile(me);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (mounted.current) setIsLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (!nextSession) setProfile(null);
      },
    );

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load the profile whenever a user id appears (sign-in / restore).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getProfile(userId).then((me) => {
      if (!cancelled) setProfile(me);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const me = await getProfile(userId);
    setProfile(me);
  }, [userId]);

  const value = useMemo(
    () => ({ session, profile, isLoading, refreshProfile }),
    [session, profile, isLoading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Convenience guard for protected screens: bounces anon users to login. */
export function useRequireAuth() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [isLoading, session, router]);

  return { session, isLoading };
}
