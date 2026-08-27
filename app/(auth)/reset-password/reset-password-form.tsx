"use client";

import { useActionState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { updatePassword, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
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
        Update password
      </Button>
    </form>
  );
}
