import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in · FIFA Tracker" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  // proxy.ts sets ?next=… so a deep link survives the sign-in detour.
  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to log a match.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </CardContent>
    </Card>
  );
}
