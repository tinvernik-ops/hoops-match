import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGeoAndNotify } from "@/hooks/use-geo";
import { fetchPlayersWithStats } from "@/lib/players";
import { fetchCourts, clusterPlayersAtCourts, createCourt } from "@/lib/courts";
import { PlayerCard } from "@/components/player-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Bell, BellOff, Plus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const { data: courts = [], refetch: refetchCourts } = useQuery({
    queryKey: ["courts"],
    queryFn: fetchCourts,
    enabled: !!user,
  });

  const courtsWithCount = clusterPlayersAtCourts(courts, players, coords);

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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "league_invites", filter: `to_id=eq.${user.id}` },
        () => {
          toast("🏆 You've been invited to a league!", { description: "Check the Leagues tab to accept." });
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("League invite 🏆", { body: "You've been invited to join a league." });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "courts" },
        () => refetchCourts()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch, refetchCourts]);

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
        <AddCourtButton coords={coords} onAdded={refetchCourts} />
      </header>

      <section className="mb-5">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Courts near you</h2>
        {courtsWithCount.length === 0 ? (
          <div className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground">
            No courts yet. Tap <Plus className="inline size-3" /> to mark one at your spot.
          </div>
        ) : (
          <div className="space-y-2">
            {courtsWithCount.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 border border-border/60">
                <div className="grid place-items-center size-12 rounded-xl bg-gradient-to-br from-primary to-rim text-primary-foreground">
                  <Users className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.distance_km != null
                      ? c.distance_km < 1 ? `${Math.round(c.distance_km * 1000)}m away` : `${c.distance_km.toFixed(1)}km away`
                      : "Distance unknown"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-display text-2xl font-bold text-primary leading-none">{c.player_count}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    {c.player_count === 1 ? "hooper" : "hoopers"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

function AddCourtButton({ coords, onAdded }: { coords: { lat: number; lng: number } | null; onAdded: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user || !coords || !name.trim()) return;
    setBusy(true);
    try {
      await createCourt({ name: name.trim().slice(0, 80), lat: coords.lat, lng: coords.lng, userId: user.id });
      toast.success("Court added at your location");
      setOpen(false);
      setName("");
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1" disabled={!coords}>
          <Plus className="size-4" /> Court
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark a court</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Pinned at your current location.</p>
        <Input
          placeholder="Court name (e.g. West Park)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <DialogFooter>
          <Button onClick={save} disabled={busy || !name.trim() || !coords} className="w-full font-bold">
            {busy ? "Saving…" : "Add court"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
