import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "./env";

/** Routes reachable while signed out. Everything else redirects to /login. */
const PUBLIC_ROUTES = ["/login", "/signup", "/auth"];

/**
 * Refreshes the Supabase auth cookie and gates private routes.
 *
 * The dance with `supabaseResponse` matters: when Supabase rotates the refresh
 * token it hands us new cookies, and they must be written onto the response
 * that is actually returned. Building a fresh NextResponse afterwards without
 * copying them across would silently sign the user out on the next request.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url: supabaseUrl, anonKey } = supabaseEnv();

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not remove: this call is what actually refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    // Come back to where they were headed after signing in.
    target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return supabaseResponse;
}
