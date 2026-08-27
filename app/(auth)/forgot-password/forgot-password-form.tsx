"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, LoaderCircle, MailCheck } from "lucide-react";

import { requestPasswordReset, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

export function ForgotPasswordForm({ sent }: { sent: boolean }) {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    INITIAL,
  );

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          If that email has an account, a reset link is on its way. Check
          your inbox — the link works once and expires after a while.
        </p>
        <Button asChild variant="secondary" className="h-12 w-full text-base">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
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
        Send reset link
      </Button>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
