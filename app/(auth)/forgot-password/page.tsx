import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

import { ForgotPasswordForm } from "./forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reset your password · Bragging Rights",
};

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  const { sent, error } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to set a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error === "expired" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            That link expired or was already used. Request a new one below.
          </p>
        )}
        <ForgotPasswordForm sent={sent === "1"} />
      </CardContent>
    </Card>
  );
}
