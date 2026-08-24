import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

import type { Database } from "@/types/database.types";

/**
 * Supabase client for Client Components.
 *
 * Safe to call on every render — @supabase/ssr memoises the underlying
 * client, so this does not open a new connection each time.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
