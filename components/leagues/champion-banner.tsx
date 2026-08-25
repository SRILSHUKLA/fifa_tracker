import { Trophy } from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { displayName } from "@/lib/format";

type Champion = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Shown at the top of a completed league's page. */
export function ChampionBanner({ champion }: { champion: Champion }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
        <Trophy className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Champion</p>
        <p className="truncate text-lg font-bold leading-tight">{displayName(champion)}</p>
      </div>
      <PlayerAvatar person={champion} size="lg" highlight />
    </div>
  );
}
