import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyLeagues } from "@/lib/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trophy, Plus, KeyRound, Loader2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/leagues/")({
  component: LeaguesIndex,
});

function LeaguesIndex() {
  const { user } = useAuth();
  const { data: leagues = [], isLoading, refetch } = useQuery({
    queryKey: ["my-leagues", user?.id],
    queryFn: () => fetchMyLeagues(user!.id),
    enabled: !!user,
  });

  const { data: pendingInvites = [], refetch: refetchInvites } = useQuery({
    queryKey: ["league-invites", user?.id],
    queryFn: async () => {
      const { data: invites, error } = await supabase
        .from("league_invites")
        .select("id, league_id, from_id")
        .eq("to_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      const list = invites ?? [];
      if (list.length === 0) return [] as Array<{ id: string; league_id: string; from_id: string; league_name: string; from_username: string }>;
      const leagueIds = [...new Set(list.map((i) => i.league_id))];
      const fromIds = [...new Set(list.map((i) => i.from_id))];
      const [{ data: lgs }, { data: profs }] = await Promise.all([
        supabase.from("leagues").select("id, name").in("id", leagueIds),
        supabase.from("profiles").select("id, username").in("id", fromIds),
      ]);
      const lMap = new Map((lgs ?? []).map((l) => [l.id, l.name]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return list.map((i) => ({
        ...i,
        league_name: lMap.get(i.league_id) ?? "League",
        from_username: pMap.get(i.from_id) ?? "someone",
      }));
    },
    enabled: !!user,
  });

  async function respond(inviteId: string, accept: boolean) {
    const { error } = await supabase
      .from("league_invites")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", inviteId);
    if (error) { toast.error(error.message); return; }
    toast.success(accept ? "Joined league" : "Declined");
    refetchInvites();
    refetch();
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-display text-4xl font-bold text-primary leading-none">LEAGUES</h1>
          <p className="text-xs text-muted-foreground mt-1">Run with your crew. Track every dub.</p>
        </div>
      </header>

      {pendingInvites.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Invites</h2>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="rounded-2xl bg-card p-4 border border-primary/30">
                <div className="font-semibold truncate">{inv.leagues?.name ?? "League"}</div>
                <div className="text-xs text-muted-foreground mb-3">from @{inv.profiles?.username ?? "someone"}</div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 font-bold" onClick={() => respond(inv.id, true)}>Accept</Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => respond(inv.id, false)}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <CreateLeagueDialog onCreated={() => refetch()} />
        <JoinLeagueDialog onJoined={() => refetch()} />
      </div>

      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Your leagues</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-card animate-pulse" />)}
        </div>
      ) : leagues.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center">
          <Trophy className="mx-auto size-10 text-primary mb-3" />
          <h3 className="font-semibold mb-1">No leagues yet</h3>
          <p className="text-sm text-muted-foreground">Create one with your usual crew or join one with a code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((l) => (
            <Link
              key={l.id}
              to="/app/leagues/$id"
              params={{ id: l.id }}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 active:scale-[0.99] transition border border-border/60"
            >
              <div className="grid place-items-center size-12 rounded-xl bg-gradient-to-br from-primary to-rim text-primary-foreground">
                <Trophy className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground">Code: <span className="font-mono">{l.join_code}</span></div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function CreateLeagueDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!user || name.trim().length < 2) {
      toast.error("Name too short");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("leagues")
      .insert({ name: name.trim().slice(0, 60), owner_id: user.id })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setName("");
    onCreated();
    toast.success("League created");
    nav({ to: "/app/leagues/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-2 rounded-2xl bg-primary text-primary-foreground py-5 font-semibold">
          <Plus className="size-6" />
          <span className="text-sm">Create league</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New league</DialogTitle></DialogHeader>
        <div>
          <Label htmlFor="lname">League name</Label>
          <Input id="lname" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Run" />
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy} className="w-full font-bold">
            {busy ? <Loader2 className="animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JoinLeagueDialog({ onJoined }: { onJoined: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!user) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) { toast.error("Invalid code"); return; }
    setBusy(true);
    const { data: league, error } = await supabase
      .from("leagues").select("id").eq("join_code", c).maybeSingle();
    if (error || !league) {
      setBusy(false);
      toast.error("League not found");
      return;
    }
    const { error: jErr } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });
    setBusy(false);
    if (jErr && !jErr.message.includes("duplicate")) {
      toast.error(jErr.message);
      return;
    }
    setOpen(false);
    setCode("");
    onJoined();
    toast.success("Joined league");
    nav({ to: "/app/leagues/$id", params: { id: league.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-2 rounded-2xl bg-secondary text-foreground py-5 font-semibold">
          <KeyRound className="size-6" />
          <span className="text-sm">Join with code</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Join a league</DialogTitle></DialogHeader>
        <div>
          <Label htmlFor="code">Join code</Label>
          <Input id="code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123" className="font-mono uppercase" />
        </div>
        <DialogFooter>
          <Button onClick={join} disabled={busy} className="w-full font-bold">
            {busy ? <Loader2 className="animate-spin" /> : "Join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
