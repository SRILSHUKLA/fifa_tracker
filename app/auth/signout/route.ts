import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/signout — an escape hatch for the broken-state redirect in
 * app/(app)/layout.tsx, where a session exists but its profile row does not.
 * Normal sign-out goes through the signOut server action instead.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url));
}
