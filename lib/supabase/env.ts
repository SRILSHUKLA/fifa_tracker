/**
 * Reads and validates the Supabase connection settings.
 *
 * Both values are meant to be public — Row Level Security is what protects the
 * data, not secrecy of the anon key. The validation exists because the two
 * common paste mistakes both fail a long way from their cause:
 *
 *   - a missing value surfaces as "supabaseUrl is required", thrown from deep
 *     inside the client library on the first request;
 *   - pasting the RESTful endpoint (…supabase.co/rest/v1) instead of the
 *     Project URL makes supabase-js build …/rest/v1/auth/v1/signup, and the
 *     gateway answers "Invalid path specified in request URL", which says
 *     nothing about where the bad path came from.
 */
export function supabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !anonKey) {
    throw new Error(
      "Missing Supabase configuration. Copy .env.local.example to .env.local " +
        "and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "from Project Settings in the Supabase dashboard.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${rawUrl}. ` +
        "It should look like https://your-project-ref.supabase.co",
    );
  }

  // supabase-js appends /auth/v1, /rest/v1 and so on itself, so anything
  // beyond the bare origin here produces a doubled path at request time.
  if (parsed.pathname !== "/") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be the Project URL with no path, but got ` +
        `${rawUrl}. Use ${parsed.origin} instead — Project Settings > Data API > ` +
        "Project URL, not the RESTful endpoint.",
    );
  }

  return { url: parsed.origin, anonKey };
}
