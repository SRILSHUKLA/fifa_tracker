import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm — where Supabase's `/auth/v1/verify` lands after someone
 * clicks the link in a "Reset Password" email.
 *
 * This project has no custom SMTP configured, so the Reset Password email
 * template can't be edited in the Supabase dashboard — it stays the default
 * `{{ .ConfirmationURL }}`. With `@supabase/ssr`'s default `flowType: "pkce"`,
 * that means the redirect back here carries a plain `?code=…`, which
 * `exchangeCodeForSession` turns into a session. That exchange only works in
 * the same browser that requested the reset (the code_verifier it needs was
 * stashed in a cookie by requestPasswordReset), so a reset requested on one
 * device and opened by email on another will land on the expired-link
 * message below — a real limitation of not having a custom template, not a
 * bug. The `token_hash` branch is dead code today but costs nothing to keep:
 * if custom SMTP is ever added and the template is changed to
 * `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`, it starts
 * working with no further changes here, and removes that same-device limit.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const dest = type === "recovery" ? "/reset-password" : "/";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
}
