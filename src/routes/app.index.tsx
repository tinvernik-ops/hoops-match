import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGeoAndNotify } from "@/hooks/use-geo";
import { fetchPlayersWithStats } from "@/lib/players";
import { fetchCourts, clusterPlayersAtCourts, createCourt, type CourtWithCount } from "@/lib/courts";
import { PlayerCard } from "@/components/player-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Bell, BellOff, Plus, Users, Navigation, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/")({
  component: CourtPage,
});

function CourtPage() {
  const { user } = useAuth();
  const { coords, denied } = useGeoAndNotify();
  const [openCourt, setOpenCourt] = useState<CourtWithCount | null>(null);

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
  const totalHoopers = players.length;
  const activeCourts = courtsWithCount.filter((c) => c.player_count > 0).length;

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("invites-incoming")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "invites", filter: `to_id=eq.${user.id}` }, (payload) => {
        const inv = payload.new as { message: string | null };
        toast("🏀 New hoop sesh invite!", { description: inv.message ?? "Someone wants to run it." });
        refetch();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "league_invites", filter: `to_id=eq.${user.id}` }, () => {
        toast("🏆 You've been invited to a league!", { description: "Check the Leagues tab to accept." });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "courts" }, () => refetchCourts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch, refetchCourts]);

  const notifEnabled = typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-5 pb-4">
      {/* Hero */}
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-display text-5xl font-black tracking-tight text-primary leading-none">HOOPS</h1>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${coords ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
              <MapPin className="size-3" /> {coords ? "Live" : denied ? "Off" : "…"}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${notifEnabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {notifEnabled ? <Bell className="size-3" /> : <BellOff className="size-3" />}
              {notifEnabled ? "On" : "Off"}
            </span>
          </div>
        </div>

        {/* Stat bar */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-rim text-primary-foreground p-4">
            <div className="text-display text-3xl font-black leading-none">{totalHoopers}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-90 mt-1.5">Hoopers nearby</div>
          </div>
          <div className="rounded-2xl bg-card border border-border/60 p-4">
            <div className="text-display text-3xl font-black leading-none text-primary">{activeCourts}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">Active courts</div>
          </div>
        </div>
      </header>

      {/* Courts */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Courts near you</h2>
          <AddCourtButton coords={coords} onAdded={refetchCourts} />
        </div>
        {courtsWithCount.length === 0 ? (
          <button
            onClick={() => coords && document.getElementById("add-court-trigger")?.click()}
            className="w-full rounded-2xl bg-card border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary transition-colors"
          >
            <Plus className="inline size-4 mr-1" /> Mark your first court
          </button>
        ) : (
          <div className="space-y-2">
            {courtsWithCount.map((c) => (
              <button
                key={c.id}
                onClick={() => setOpenCourt(c)}
                className="w-full flex items-center gap-3 rounded-2xl bg-card p-4 border border-border/60 hover:border-primary/50 transition-colors text-left"
              >
                <div className={`grid place-items-center size-12 rounded-xl shrink-0 ${c.player_count > 0 ? "bg-gradient-to-br from-primary to-rim text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <Users className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Navigation className="size-3" />
                    {c.distance_km != null
                      ? c.distance_km < 1 ? `${Math.round(c.distance_km * 1000)}m` : `${c.distance_km.toFixed(1)}km`
                      : "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-display text-2xl font-black leading-none ${c.player_count > 0 ? "text-primary" : "text-muted-foreground"}`}>{c.player_count}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
                    {c.player_count === 1 ? "hooper" : "hoopers"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Hoopers */}
      <section>
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
      </section>

      <CourtMapDialog court={openCourt} onClose={() => setOpenCourt(null)} />
    </main>
  );
}

function CourtMapDialog({ court, onClose }: { court: CourtWithCount | null; onClose: () => void }) {
  if (!court) return null;
  const delta = 0.003;
  const bbox = `${court.lng - delta}%2C${court.lat - delta}%2C${court.lng + delta}%2C${court.lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${court.lat}%2C${court.lng}`;
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${court.lat},${court.lng}`;
  return (
    <Dialog open={!!court} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-display text-xl">{court.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {court.player_count} {court.player_count === 1 ? "hooper" : "hoopers"} here
            {court.distance_km != null && ` · ${court.distance_km < 1 ? Math.round(court.distance_km * 1000) + "m" : court.distance_km.toFixed(1) + "km"} away`}
          </p>
        </DialogHeader>
        <div className="relative w-full aspect-square bg-secondary">
          <iframe
            title={`Map of ${court.name}`}
            src={src}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
          />
        </div>
        <div className="p-4 grid grid-cols-2 gap-2">
          <a
            href={gmaps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary text-secondary-foreground py-3 text-sm font-bold"
          >
            <ExternalLink className="size-4" /> Google Maps
          </a>
          <Button onClick={onClose} className="font-bold">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
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
        <Button id="add-court-trigger" size="sm" variant="secondary" className="gap-1 h-8" disabled={!coords}>
          <Plus className="size-4" /> Add
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
