import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * One app-wide Supabase client. Sessions persist through AsyncStorage so a
 * user stays signed in across launches, exactly like the cookie-based flow
 * in the web app.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Password recovery relies on this: it makes resetPasswordForEmail
    // stash a code_verifier in AsyncStorage and put a plain `?code=` query
    // param in the emailed link (via the default, unedited Reset Password
    // template — this project has no custom SMTP, so the template can't be
    // changed to the `token_hash` form the web app additionally supports).
    // The default "implicit" flow would instead put tokens after a `#`,
    // which expo-router's route params can't see. See reset-password.tsx.
    flowType: "pkce",
  },
});
