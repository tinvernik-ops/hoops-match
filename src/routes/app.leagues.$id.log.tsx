import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchLeagueData } from "@/lib/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import type { GameType } from "@/lib/leagues";
import { sendPushTo } from "@/lib/push";

const GAME_TYPES: GameType[] = ["1v1", "2v2", "3v3", "4v4", "5v5", "koth"];
const GAME_TYPE_LABELS: Record<GameType, string> = {
  "1v1": "1v1", "2v2": "2v2", "3v3": "3v3", "4v4": "4v4", "5v5": "5v5", koth: "KOTH",
};

export const Route = createFileRoute("/app/leagues/$id/log")({
  component: LogGamePage,
});

type StatLine = { user_id: string; team: "A" | "B"; points: number; rebounds: number; assists: number; steals: number; blocks: number };

function LogGamePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [location, setLocation] = useState("");
  const [gameType, setGameType] = useState<GameType>("5v5");
  const [stats, setStats] = useState<Record<string, StatLine>>({});

  const { data } = useQuery({
    queryKey: ["league", id],
    queryFn: () => fetchLeagueData(id),
    enabled: !!user,
  });

  const members = useMemo(() => data?.members ?? [], [data]);

  function setTeam(uid: string, team: "A" | "B" | null) {
    setStats((s) => {
      const next = { ...s };
      if (team == null) {
        delete next[uid];
      } else {
        next[uid] = next[uid]
          ? { ...next[uid], team }
          : { user_id: uid, team, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };
      }
      return next;
    });
  }

  function bump(uid: string, key: keyof Omit<StatLine, "user_id" | "team">, delta: number) {
    setStats((s) => {
      const cur = s[uid];
      if (!cur) return s;
      return { ...s, [uid]: { ...cur, [key]: Math.max(0, cur[key] + delta) } };
    });
  }

  async function save() {
    if (!user) return;
    const lines = Object.values(stats);
    if (lines.length < 2) {
      toast.error("Pick at least 2 players");
      return;
    }
    if (!lines.some((l) => l.team === "A") || !lines.some((l) => l.team === "B")) {
      toast.error("Each team needs at least one player");
      return;
    }
    setBusy(true);
    const { data: game, error } = await supabase
      .from("games")
      .insert({
        league_id: id,
        created_by: user.id,
        team_a_score: scoreA,
        team_b_score: scoreB,
        location: location.trim() || null,
        game_type: gameType,
      })
      .select()
      .single();
    if (error || !game) {
      setBusy(false);
      toast.error(error?.message ?? "Failed");
      return;
    }
    const { error: gpErr } = await supabase
      .from("game_players")
      .insert(lines.map((l) => ({ ...l, game_id: game.id })));
    setBusy(false);
    if (gpErr) {
      toast.error(gpErr.message);
      return;
    }
    // Notify every other player to verify the score
    const winner = scoreA === scoreB ? "Tied" : scoreA > scoreB ? "Team A won" : "Team B won";
    const body = `${winner} ${scoreA}-${scoreB} · tap to verify the score`;
    await Promise.all(
      lines
        .filter((l) => l.user_id !== user.id)
        .map((l) =>
          sendPushTo({
            toUserId: l.user_id,
            title: "Verify game score",
            body,
            url: `/app/games/${game.id}/verify`,
            tag: `verify-${game.id}`,
          })
        )
    );
    toast.success("Game logged — players notified to verify");
    nav({ to: "/app/leagues/$id", params: { id } });
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4">
      <button onClick={() => nav({ to: "/app/leagues/$id", params: { id } })}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Back
      </button>

      <h1 className="text-display text-3xl font-bold mb-4">Log a game</h1>

      <section className="rounded-2xl bg-card p-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <ScoreInput label="Team A" value={scoreA} onChange={setScoreA} highlight={scoreA > scoreB} />
          <ScoreInput label="Team B" value={scoreB} onChange={setScoreB} highlight={scoreB > scoreA} />
        </div>
        <div className="mt-3">
          <Label>Game type</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {GAME_TYPES.map((g) => (
              <button type="button" key={g} onClick={() => setGameType(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  gameType === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>
                {GAME_TYPE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="loc">Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="loc" maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="Rucker Park" />
        </div>
      </section>

      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Players & stats</h2>
      <div className="space-y-3">
        {members.map((m) => {
          const line = stats[m.user_id];
          return (
            <div key={m.user_id} className="rounded-2xl bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="font-semibold flex-1 truncate">@{m.username}</div>
                <div className="flex rounded-lg bg-secondary p-0.5 text-xs">
                  {(["A", "B"] as const).map((t) => (
                    <button key={t} onClick={() => setTeam(m.user_id, line?.team === t ? null : t)}
                      className={`px-3 py-1.5 rounded-md font-bold ${
                        line?.team === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {line && (
                <div className="grid grid-cols-5 gap-1.5 mt-3">
                  {(["points", "rebounds", "assists", "steals", "blocks"] as const).map((k) => (
                    <StatStepper key={k} label={k.slice(0, 3).toUpperCase()} value={line[k]}
                      onInc={() => bump(m.user_id, k, 1)} onDec={() => bump(m.user_id, k, -1)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {members.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            No members yet — share the league code so your crew can join.
          </div>
        )}
      </div>

      <Button onClick={save} disabled={busy} className="w-full h-14 mt-6 font-bold text-base" size="lg">
        {busy ? <Loader2 className="animate-spin" /> : "Save game"}
      </Button>
    </main>
  );
}

function ScoreInput({ label, value, onChange, highlight }: { label: string; value: number; onChange: (n: number) => void; highlight: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? "bg-primary/10 border-2 border-primary" : "bg-secondary border-2 border-transparent"}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center justify-center gap-2 mt-1">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="grid place-items-center size-8 rounded-full bg-card">
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="text-display text-3xl font-bold text-primary bg-transparent text-center w-14 outline-none"
        />
        <button onClick={() => onChange(value + 1)} className="grid place-items-center size-8 rounded-full bg-card">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function StatStepper({ label, value, onInc, onDec }: { label: string; value: number; onInc: () => void; onDec: () => void }) {
  return (
    <div className="rounded-lg bg-secondary p-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between mt-0.5">
        <button onClick={onDec} className="grid place-items-center size-5 rounded-full bg-card text-muted-foreground"><Minus className="size-3" /></button>
        <span className="text-display text-lg font-bold">{value}</span>
        <button onClick={onInc} className="grid place-items-center size-5 rounded-full bg-card text-primary"><Plus className="size-3" /></button>
      </div>
    </div>
  );
}
