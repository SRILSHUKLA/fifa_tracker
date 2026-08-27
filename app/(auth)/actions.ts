"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

const USERNAME_RULE = /^[a-zA-Z0-9_]{3,20}$/;

/** Where to land after auth, guarded so `next` cannot be used as an open redirect. */
function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase deliberately does not say which half was wrong, and neither
    // should we — it would confirm whether an address has an account.
    return { error: "That email and password do not match an account." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();

  if (!email || !password || !username) {
    return { error: "Fill in every field." };
  }

  if (!USERNAME_RULE.test(username)) {
    return {
      error:
        "Usernames are 3-20 characters, letters, numbers and underscores only.",
    };
  }

  if (password.length < 6) {
    return { error: "Use a password of at least 6 characters." };
  }

  const supabase = await createClient();

  // Check the handle first so a clash comes back as a readable message rather
  // than the opaque "Database error saving new user" that the profiles trigger
  // would otherwise produce. A race is still possible, hence the catch below.
  const { data: available } = await supabase.rpc("is_username_available", {
    u: username,
  });

  if (available === false) {
    return { error: `@${username} is already taken.` };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    // handle_new_user() reads username out of raw_user_meta_data.
    options: { data: { username } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "That email already has an account. Try signing in." };
    }
    if (error.message.toLowerCase().includes("database error")) {
      return { error: `@${username} was just taken. Pick another.` };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // GoTrue's /verify redirects here with ?code=… appended, since this
    // client's default flowType is "pkce" — see auth/confirm/route.ts.
    redirectTo: `${origin}/auth/confirm`,
  });

  // Supabase deliberately succeeds even for an unknown address, so this
  // page can't be used to check whether an email has an account. A real
  // failure here (e.g. rate limiting) is the only thing worth surfacing.
  if (error) {
    return { error: "Could not send the email. Try again in a moment." };
  }

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    return { error: "Use a password of at least 6 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // The recovery session behind this page has its own short lifetime,
    // separate from a normal sign-in — this is what expires or double-use
    // of the email link looks like.
    return {
      error: "Your reset link has expired or was already used.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
