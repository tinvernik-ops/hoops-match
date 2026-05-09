import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGeoAndNotify } from "@/hooks/use-geo";
import { fetchPlayersWithStats } from "@/lib/players";
import { PlayerCard } from "@/components/player-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Bell, BellOff } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: CourtPage,
});

function CourtPage() {
  const { user } = useAuth();
  const { coords, denied } = useGeoAndNotify();

  const { data: players = [], isLoading, refetch } = useQuery({
    queryKey: ["players", user?.id, coords?.lat, coords?.lng],
    queryFn: () => fetchPlayersWithStats(user!.id, coords),
    enabled: !!user,
  });

  // Realtime: notify on incoming invites
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("invites-incoming")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invites", filter: `to_id=eq.${user.id}` },
        (payload) => {
          const inv = payload.new as { message: string | null };
          toast("🏀 New hoop sesh invite!", { description: inv.message ?? "Someone wants to run it." });
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Hoop sesh invite 🏀", { body: inv.message ?? "Someone wants to run it." });
          }
          refetch();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch]);

  const notifEnabled = typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-display text-4xl font-bold text-primary leading-none">HOOPS</h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="size-3" />
            {coords ? "Live location" : denied ? "Location off" : "Locating…"}
            <span className="mx-1">·</span>
            {notifEnabled ? <Bell className="size-3" /> : <BellOff className="size-3" />}
            {notifEnabled ? "Notifs on" : "Notifs off"}
          </p>
        </div>
      </header>

      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Hoopers near you</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {players.map((p) => <PlayerCard key={p.id} p={p} />)}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card p-8 text-center">
      <div className="text-5xl mb-3">🏟️</div>
      <h3 className="font-semibold mb-1">Court's empty</h3>
      <p className="text-sm text-muted-foreground">No hoopers around yet. Invite friends to join Hoops and they'll show up here.</p>
    </div>
  );
}
