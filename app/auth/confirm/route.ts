import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm — where Supabase's `/auth/v1/verify` lands after someone
 * clicks the link in a "Reset Password" email.
 *
 * This deliberately verifies a `token_hash` (via `verifyOtp`) rather than
 * exchanging a PKCE `code`. A `code` exchange only works in the same browser
 * that requested it, which breaks the common case of requesting the reset
 * on one device and opening the email on another; `token_hash` has no such
 * requirement. The Reset Password template in the Supabase dashboard must
 * build its link as `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`
 * for this to receive the right params — see requestPasswordReset in
 * app/(auth)/actions.ts for the redirectTo this depends on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const dest = type === "recovery" ? "/reset-password" : "/";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
}
