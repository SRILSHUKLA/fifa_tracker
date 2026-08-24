import Link from "next/link";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Brand size="lg" />

      <div>
        <p className="text-5xl font-bold tracking-tight text-primary">404</p>
        <p className="mt-2 text-muted-foreground">
          That page went wide of the post.
        </p>
      </div>

      <Button asChild>
        <Link href="/">Back to your dashboard</Link>
      </Button>
    </div>
  );
}
