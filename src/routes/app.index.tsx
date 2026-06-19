import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGeoAndNotify } from "@/hooks/use-geo";
import { useLang } from "@/hooks/use-lang";
import { useRadius } from "@/hooks/use-radius";
import { fetchPlayersWithStats } from "@/lib/players";
import { fetchCourts, clusterPlayersAtCourts, createCourt, type CourtWithCount } from "@/lib/courts";
import { PlayerCard } from "@/components/player-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Bell, BellOff, Plus, Users, Navigation, ExternalLink, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: CourtPage,
});

function CourtPage() {
  const { user } = useAuth();
  const { coords, denied } = useGeoAndNotify();
  const { t } = useLang();
  const { courtsKm, hoopersKm } = useRadius();
  const [openCourt, setOpenCourt] = useState<CourtWithCount | null>(null);

  const { data: allPlayers = [], isLoading, refetch } = useQuery({
    queryKey: ["players", user?.id, coords?.lat, coords?.lng],
    queryFn: () => fetchPlayersWithStats(user!.id, coords),
    enabled: !!user,
  });

  const { data: allCourts = [], refetch: refetchCourts } = useQuery({
    queryKey: ["courts"],
    queryFn: fetchCourts,
    enabled: !!user,
  });

  // Apply radius filters (if no coords yet, show everything)
  const players = coords
    ? allPlayers.filter((p) => p.distance_km == null || p.distance_km <= hoopersKm)
    : allPlayers;
  const courtsAll = clusterPlayersAtCourts(allCourts, allPlayers, coords);
  const courtsWithCount = coords
    ? courtsAll.filter((c) => c.distance_km == null || c.distance_km <= courtsKm)
    : courtsAll;

  const totalHoopers = players.length;
  const activeCourts = courtsWithCount.filter((c) => c.player_count > 0).length;

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("invites-incoming")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "invites", filter: `to_id=eq.${user.id}` }, (payload) => {
        const inv = payload.new as { message: string | null };
        toast("🏀 " + t("player.invite_sent"), { description: inv.message ?? "" });
        refetch();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "league_invites", filter: `to_id=eq.${user.id}` }, () => {
        toast("🏆 " + t("ld.invite_sent"));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "courts" }, () => refetchCourts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch, refetchCourts, t]);

  const notifEnabled = typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-5 pb-4">
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-display text-5xl font-black tracking-tight text-primary leading-none">HOOPS</h1>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${coords ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
              <MapPin className="size-3" /> {coords ? t("home.live") : denied ? t("home.off") : "…"}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${notifEnabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {notifEnabled ? <Bell className="size-3" /> : <BellOff className="size-3" />}
              {notifEnabled ? t("home.on") : t("home.off")}
            </span>
            <InboxButton />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-rim text-primary-foreground p-4">
            <div className="text-display text-3xl font-black leading-none">{totalHoopers}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-90 mt-1.5">{t("home.hoopers_nearby")}</div>
          </div>
          <div className="rounded-2xl bg-card border border-border/60 p-4">
            <div className="text-display text-3xl font-black leading-none text-primary">{activeCourts}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">{t("home.active_courts")}</div>
          </div>
        </div>
      </header>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{t("home.courts_near")} · {courtsKm}km</h2>
          <AddCourtButton coords={coords} onAdded={refetchCourts} />
        </div>
        {courtsWithCount.length === 0 ? (
          <button
            onClick={() => coords && document.getElementById("add-court-trigger")?.click()}
            className="w-full rounded-2xl bg-card border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary transition-colors"
          >
            <Plus className="inline size-4 mr-1" /> {t("home.mark_first")}
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
                    {c.player_count === 1 ? t("home.hooper") : t("home.hoopers")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{t("home.hoopers_near")} · {hoopersKm}km</h2>
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
  const { t } = useLang();
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
            {court.player_count} {court.player_count === 1 ? t("home.hooper") : t("home.hoopers")} {t("home.here")}
            {court.distance_km != null && ` · ${court.distance_km < 1 ? Math.round(court.distance_km * 1000) + "m" : court.distance_km.toFixed(1) + "km"} ${t("common.away")}`}
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
            <ExternalLink className="size-4" /> {t("home.gmaps")}
          </a>
          <Button onClick={onClose} className="font-bold">{t("common.close")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCourtButton({ coords, onAdded }: { coords: { lat: number; lng: number } | null; onAdded: () => void }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user || !coords || !name.trim()) return;
    setBusy(true);
    try {
      await createCourt({ name: name.trim().slice(0, 80), lat: coords.lat, lng: coords.lng, userId: user.id });
      toast.success(t("toast.court_added"));
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
          <Plus className="size-4" /> {t("home.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("home.court.mark")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{t("home.court.pinned")}</p>
        <Input
          placeholder={t("home.court.name_ph")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <DialogFooter>
          <Button onClick={save} disabled={busy || !name.trim() || !coords} className="w-full font-bold">
            {busy ? t("home.court.saving") : t("home.court.add_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div className="rounded-2xl bg-card p-8 text-center">
      <div className="text-5xl mb-3">🏟️</div>
      <h3 className="font-semibold mb-1">{t("home.empty.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("home.empty.sub")}</p>
    </div>
  );
}

function InboxButton() {
  const { user } = useAuth();
  const { data: unread = 0, refetch } = useQuery({
    queryKey: ["dm-unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("dm-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch]);

  return (
    <Link to="/app/messages" className="relative grid place-items-center size-9 rounded-full bg-secondary text-foreground" aria-label="Messages">
      <MessageSquare className="size-4" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
