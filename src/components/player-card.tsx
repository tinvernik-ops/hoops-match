import { Link } from "@tanstack/react-router";
import type { PlayerWithStats } from "@/lib/players";
import { MapPin } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

function RatingDot({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = value == null ? "text-muted-foreground" : v >= 80 ? "text-rim" : v >= 60 ? "text-primary" : "text-foreground";
  return (
    <div className="flex flex-col items-center">
      <div
        className="rating-ring grid place-items-center size-12 rounded-full"
        style={{ ["--p" as string]: String(value ?? 0) }}
      >
        <div className="grid place-items-center size-10 rounded-full bg-card">
          <span className={`text-display text-lg font-bold ${color}`}>{value ?? "—"}</span>
        </div>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export function PlayerCard({ p }: { p: PlayerWithStats }) {
  return (
    <Link
      to="/app/player/$id"
      params={{ id: p.id }}
      className="flex items-center gap-4 rounded-2xl bg-card p-4 active:scale-[0.99] transition border border-border/60"
    >
      <UserAvatar avatarPath={p.avatar_url} fallback={p.username} className="size-14" textClassName="text-2xl" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">@{p.username}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin className="size-3" />
          {p.distance_km != null
            ? `${p.distance_km < 1 ? `${Math.round(p.distance_km * 1000)}m` : `${p.distance_km.toFixed(1)}km`} away`
            : "Location unknown"}
          {p.height_cm != null && <span>· {p.height_cm}cm</span>}
        </div>
      </div>
      <div className="flex gap-3 shrink-0">
        <RatingDot label="OFF" value={p.offense_avg} />
        <RatingDot label="DEF" value={p.defense_avg} />
      </div>
    </Link>
  );
}
