import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { displayName, initials } from "@/lib/format";
import type { Profile } from "@/types/database.types";

export function AppHeader({ profile }: { profile: Profile }) {
  const name = displayName(profile);

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
        <Brand size="sm" />

        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-semibold">
              {initials(name)}
            </AvatarFallback>
          </Avatar>

          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              className="text-muted-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
