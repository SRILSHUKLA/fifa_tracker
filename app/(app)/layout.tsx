import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";

/**
 * Shell for every signed-in screen.
 *
 * proxy.ts already redirects anonymous visitors, but the check is
 * repeated here: the proxy is a convenience, not a security boundary, and
 * this layout needs the profile anyway.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { count: pendingRequests }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", user.id)
      .eq("status", "pending"),
  ]);

  // A signed-in user with no profile row means the handle_new_user trigger
  // never ran. Signing out is the only recoverable action.
  if (!profile) redirect("/auth/signout");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} />

      {/* pb-28 clears the fixed bottom nav and its raised centre button. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-4">
        {children}
      </main>

      <BottomNav pendingRequests={pendingRequests ?? 0} />
    </div>
  );
}
