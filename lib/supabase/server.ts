import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseEnv } from "./env";

import type { Database } from "@/types/database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per request — never hoist this into a module-level constant,
 * or one user's session would leak into another's request.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies. This is safe to swallow
          // because proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}

/**
 * The signed-in user's id, or null. Reads from the verified JWT via
 * `getUser()` rather than `getSession()`, which trusts the cookie blindly.
 */
export async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
