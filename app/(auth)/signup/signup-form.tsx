"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { signUp, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-muted-foreground">
            @
          </span>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="rooney_07"
            pattern="[a-zA-Z0-9_]{3,20}"
            maxLength={20}
            required
            className="h-12 pl-8 text-base"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          This is how friends will find you.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="you@example.com"
          required
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          className="h-12 text-base"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full text-base">
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Create account
      </Button>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        Already have one?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
