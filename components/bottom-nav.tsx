"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, Medal, Plus, Trophy, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/leaderboard", label: "Table", icon: Trophy },
  { href: "/groups", label: "Groups", icon: UsersRound },
  { href: "/leagues", label: "Leagues", icon: Medal },
  { href: "/history", label: "History", icon: History },
] as const;

/**
 * Fixed bottom tab bar with a raised "add match" button in the middle.
 *
 * Everything sits at the bottom of the screen because that is where a thumb
 * is when you are holding a phone in one hand and a controller in the other.
 */
export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-6 items-end px-2">
        {TABS.slice(0, 2).map((tab) => (
          <NavTab key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}

        {/* Centre slot: the primary action, raised above the bar. */}
        <div className="flex justify-center">
          <Link
            href="/match/new"
            aria-label="Log a match"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </Link>
        </div>

        {TABS.slice(2).map((tab) => (
          <NavTab key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
