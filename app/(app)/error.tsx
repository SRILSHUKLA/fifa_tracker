"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Catches render-time failures inside the app shell. The most likely cause in
 * practice is a paused free-tier Supabase project, so the copy says so rather
 * than showing a raw stack trace.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </div>

      <div>
        <h1 className="font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          We could not load that. If your Supabase project has been idle for a
          week it may need waking up from the dashboard.
        </p>
      </div>

      <Button onClick={reset} variant="secondary">
        <RotateCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
