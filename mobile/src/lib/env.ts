/**
 * Public-by-design Supabase credentials — RLS is the authorization layer,
 * so these ship with the app bundle just like they do in the web app's
 * client bundle.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;
