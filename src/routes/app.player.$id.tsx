import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fromPublicProfiles, type PublicProfile } from "@/lib/public-profiles";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Loader2, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { distanceKm } from "@/lib/players";
import { sendPushTo } from "@/lib/push";
import { StatBarCard } from "@/components/stat-bar-card";

export const Route = createFileRoute("/app/player/$id")({
  component: PlayerPage,
});

function PlayerPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["player", id, user?.id],
    queryFn: async () => {
      const [{ data: profile, error: pErr }, { data: ratings, error: rErr }, { data: mine }, { data: me }, { data: canRate }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("ratings").select("offense,defense").eq("ratee_id", id),
        supabase.from("ratings").select("offense,defense").eq("rater_id", user!.id).eq("ratee_id", id).maybeSingle(),
        supabase.from("profiles").select("lat,lng").eq("id", user!.id).maybeSingle(),
        supabase.rpc("can_rate", { _rater: user!.id, _ratee: id }),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const n = ratings?.length ?? 0;
      const o = n ? Math.round(ratings!.reduce((s, r) => s + r.offense, 0) / n) : null;
      const d = n ? Math.round(ratings!.reduce((s, r) => s + r.defense, 0) / n) : null;
      const dist = profile?.lat != null && profile?.lng != null && me?.lat != null && me?.lng != null
        ? distanceKm({ lat: me.lat, lng: me.lng }, { lat: profile.lat, lng: profile.lng })
        : null;
      return { profile, offense: o, defense: d, count: n, myRating: mine, distance: dist, canRate: !!canRate };
    },
    enabled: !!user,
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!data.profile) return <div className="p-6">Player not found.</div>;

  const p = data.profile;

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4">
      <button onClick={() => nav({ to: "/app" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Back
      </button>

      <StatBarCard
        initial={p.username.slice(0, 1).toUpperCase()}
        name={p.username}
        defense={data.defense}
        offense={data.offense}
        avatarPath={(p as { avatar_url?: string | null }).avatar_url ?? null}
      />

      <div className="rounded-3xl bg-card p-6 text-center mt-4">
        <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
          <MapPin className="size-3" />
          {data.distance != null
            ? data.distance < 1 ? `${Math.round(data.distance * 1000)}m away` : `${data.distance.toFixed(1)}km away`
            : "Location unknown"}
          {p.height_cm != null && <span>· {p.height_cm}cm</span>}
        </div>

        {(p.playstyle || p.preferred_game_type) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            {p.preferred_game_type && (
              <span className="rounded-full bg-primary/15 text-primary font-bold px-3 py-1 uppercase tracking-wider">
                {p.preferred_game_type === "koth" ? "King of the Hill" : p.preferred_game_type}
              </span>
            )}
            {p.playstyle && (
              <span className="rounded-full bg-secondary px-3 py-1 text-muted-foreground italic">
                "{p.playstyle}"
              </span>
            )}
          </div>
        )}

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4">
          {data.count} {data.count === 1 ? "rating" : "ratings"}
        </p>

        <div className="mt-6 space-y-2">
          <Link
            to="/app/messages/$userId"
            params={{ userId: p.id }}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-secondary py-3 font-bold"
          >
            <MessageSquare className="size-5" /> Message @{p.username}
          </Link>
          <CallUpButton toId={p.id} toName={p.username} />
          {data.canRate ? (
            <RateDialog
              toId={p.id}
              initial={data.myRating ?? null}
              onSaved={() => refetch()}
            />
          ) : (
            <div className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground text-center">
              You can rate @{p.username} after you play together (logged league game) or once they accept your hoop sesh invite.
            </div>
          )}
        </div>
      </div>

      <Link to="/app" className="block text-center text-xs text-muted-foreground mt-6 underline">
        Back to court
      </Link>
    </main>
  );
}




function CallUpButton({ toId, toName }: { toId: string; toName: string }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("Yo, run it? 🏀");

  async function send() {
    if (!user) return;
    setBusy(true);
    const message = msg.trim().slice(0, 280) || null;
    const { error } = await supabase.from("invites").insert({
      from_id: user.id,
      to_id: toId,
      message,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    sendPushTo({ toUserId: toId, title: "🏀 Hoop sesh invite", body: message ?? "Someone wants to run it.", url: "/app", tag: `invite-${user.id}` });
    setOpen(false);
    toast.success(`Invite sent to @${toName}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full h-14 text-base font-bold">
          🏀 Call up for a hoop sesh
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite @{toName}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          maxLength={280}
          placeholder="Court, time, vibe…"
          rows={3}
        />
        <DialogFooter>
          <Button onClick={send} disabled={busy} className="w-full font-bold">
            {busy ? <Loader2 className="animate-spin" /> : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateDialog({
  toId,
  initial,
  onSaved,
}: {
  toId: string;
  initial: { offense: number; defense: number } | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState(initial?.offense ?? 75);
  const [def, setDef] = useState(initial?.defense ?? 75);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("ratings")
      .upsert({ rater_id: user.id, ratee_id: toId, offense: off, defense: def }, { onConflict: "rater_id,ratee_id" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rating saved");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="lg" className="w-full">
          {initial ? "Update rating" : "Rate this player"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How they hoop</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <RatingSlider label="Offense" value={off} onChange={setOff} />
          <RatingSlider label="Defense" value={def} onChange={setDef} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy} className="w-full font-bold">
            {busy ? <Loader2 className="animate-spin" /> : "Save rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-display text-3xl font-bold text-primary">{value}</span>
      </div>
      <Slider value={[value]} min={0} max={99} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
