import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/drills")({
  component: DrillsPage,
});

// Half-court shot zones with normalized x/y in 0–100 / 0–100 (court 100w x 100h)
type Zone = { id: string; label: string; x: number; y: number };
const ZONES: Zone[] = [
  { id: "rim", label: "At Rim", x: 50, y: 88 },
  { id: "paint_l", label: "Paint L", x: 35, y: 78 },
  { id: "paint_r", label: "Paint R", x: 65, y: 78 },
  { id: "ft", label: "Free Throw", x: 50, y: 65 },
  { id: "mid_l", label: "Mid L", x: 22, y: 70 },
  { id: "mid_r", label: "Mid R", x: 78, y: 70 },
  { id: "elbow_l", label: "Elbow L", x: 32, y: 55 },
  { id: "elbow_r", label: "Elbow R", x: 68, y: 55 },
  { id: "three_corner_l", label: "Corner 3 L", x: 8, y: 88 },
  { id: "three_corner_r", label: "Corner 3 R", x: 92, y: 88 },
  { id: "three_wing_l", label: "Wing 3 L", x: 14, y: 50 },
  { id: "three_wing_r", label: "Wing 3 R", x: 86, y: 50 },
  { id: "three_top", label: "Top of Key 3", x: 50, y: 35 },
];

type Entry = { made: string; att: string };

function DrillsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [selected, setSelected] = useState<Zone>(ZONES[0]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [busy, setBusy] = useState(false);

  const { data: drills, refetch } = useQuery({
    queryKey: ["drills", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_drills")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totals = useMemo(() => {
    const map = new Map<string, { makes: number; attempts: number }>();
    for (const d of drills ?? []) {
      const cur = map.get(d.zone) ?? { makes: 0, attempts: 0 };
      cur.makes += d.makes;
      cur.attempts += d.attempts;
      map.set(d.zone, cur);
    }
    return map;
  }, [drills]);

  // Overall shooting rating 35–99 based on aggregate make %.
  const overallRating = useMemo(() => {
    let m = 0, a = 0;
    for (const v of totals.values()) { m += v.makes; a += v.attempts; }
    if (a === 0) return null;
    const pct = m / a;
    return Math.round(35 + pct * 64);
  }, [totals]);

  // Group history rows that were inserted together into "sessions" by created_at
  const sessions = useMemo(() => {
    const map = new Map<string, typeof drills>();
    for (const d of drills ?? []) {
      const key = d.created_at;
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([ts, rows]) => {
      const makes = rows!.reduce((s, r) => s + r.makes, 0);
      const attempts = rows!.reduce((s, r) => s + r.attempts, 0);
      const pct = attempts ? makes / attempts : 0;
      const rating = attempts ? Math.round(35 + pct * 64) : null;
      return { ts, rows: rows!, makes, attempts, rating };
    });
  }, [drills]);

  function setEntry(id: string, patch: Partial<Entry>) {
    setEntries((e) => {
      const cur = e[id] ?? { made: "", att: "" };
      return { ...e, [id]: { ...cur, ...patch } };
    });
  }

  async function logSession() {
    if (!user) return;
    const rows: Array<{
      user_id: string;
      zone: string;
      x: number;
      y: number;
      attempts: number;
      makes: number;
      created_at: string;
    }> = [];
    const ts = new Date().toISOString();
    for (const z of ZONES) {
      const e = entries[z.id];
      if (!e) continue;
      const attempts = Number(e.att);
      const makes = Number(e.made);
      if (!attempts && !makes) continue;
      if (!Number.isFinite(attempts) || attempts < 1 || attempts > 999) {
        toast.error(`${z.label}: attempts must be 1–999`);
        return;
      }
      if (!Number.isFinite(makes) || makes < 0 || makes > attempts) {
        toast.error(`${z.label}: makes must be 0–${attempts}`);
        return;
      }
      rows.push({ user_id: user.id, zone: z.id, x: z.x, y: z.y, attempts, makes, created_at: ts });
    }
    if (rows.length === 0) {
      toast.error("Enter shots for at least one zone");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("shooting_drills").insert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntries({});
    toast.success(`Session logged · ${rows.length} zone${rows.length > 1 ? "s" : ""}`);
    refetch();
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
  }

  async function removeSession(ts: string) {
    if (!user) return;
    const { error } = await supabase
      .from("shooting_drills")
      .delete()
      .eq("user_id", user.id)
      .eq("created_at", ts);
    if (error) toast.error(error.message);
    else {
      toast.success("Session removed");
      refetch();
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    }
  }

  function pctColor(pct: number) {
    if (pct >= 60) return "fill-primary";
    if (pct >= 40) return "fill-rim";
    return "fill-muted";
  }

  const filledCount = ZONES.filter((z) => {
    const e = entries[z.id];
    return e && (e.made || e.att);
  }).length;

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-24">
      <button onClick={() => nav({ to: "/app/profile" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Profile
      </button>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-bold">Shooting drills</h1>
          <p className="text-xs text-muted-foreground mb-4">
            Log one session covering every spot you shot from — private to you.
          </p>
        </div>
        <div className="rating-ring grid place-items-center size-16 rounded-full shrink-0 mb-4" style={{ ["--p" as string]: String(overallRating ?? 0) }}>
          <div className="grid place-items-center size-[3.25rem] rounded-full bg-card text-center">
            <div>
              <div className="text-display text-xl font-bold leading-none text-primary">{overallRating ?? "—"}</div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground mt-0.5">Shot rtg</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-3">
        <svg viewBox="0 0 100 100" className="w-full aspect-square select-none">
          <rect x="0" y="0" width="100" height="100" rx="2" className="fill-secondary" />
          <path d="M 8,100 L 8,80 A 42,42 0 0 1 92,80 L 92,100" fill="none" className="stroke-border" strokeWidth="0.6" />
          <rect x="35" y="65" width="30" height="35" fill="none" className="stroke-border" strokeWidth="0.6" />
          <circle cx="50" cy="65" r="8" fill="none" className="stroke-border" strokeWidth="0.6" />
          <circle cx="50" cy="90" r="2" fill="none" className="stroke-primary" strokeWidth="0.8" />
          <line x1="42" y1="93" x2="58" y2="93" className="stroke-primary" strokeWidth="0.8" />

          {ZONES.map((z) => {
            const t = totals.get(z.id);
            const pct = t && t.attempts > 0 ? Math.round((t.makes / t.attempts) * 100) : null;
            const isSel = selected.id === z.id;
            const filled = !!entries[z.id] && !!(entries[z.id].made || entries[z.id].att);
            return (
              <g key={z.id} onClick={() => setSelected(z)} className="cursor-pointer">
                <circle
                  cx={z.x}
                  cy={z.y}
                  r={isSel ? 5.2 : 4}
                  className={pct != null ? pctColor(pct) : filled ? "fill-primary/60" : "fill-card"}
                  stroke={isSel ? "white" : "currentColor"}
                  strokeWidth={isSel ? 0.9 : 0.4}
                />
                {pct != null && (
                  <text x={z.x} y={z.y + 1.4} textAnchor="middle" fontSize="3" fontWeight="700" className="fill-background">
                    {pct}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="mt-3 rounded-xl bg-secondary p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">New session</div>
              <div className="text-display text-xl font-bold">{selected.label}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {filledCount} / {ZONES.length} zones filled
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center mt-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Zone</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground w-20 text-center">Made</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground w-20 text-center">Att</div>
            {ZONES.map((z) => {
              const e = entries[z.id] ?? { made: "", att: "" };
              const isSel = selected.id === z.id;
              return (
                <div key={z.id} className="contents">
                  <button
                    type="button"
                    onClick={() => setSelected(z)}
                    className={`text-left text-sm truncate ${isSel ? "font-bold text-foreground" : "text-muted-foreground"}`}
                  >
                    {z.label}
                  </button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={e.made}
                    onChange={(ev) => setEntry(z.id, { made: ev.target.value })}
                    placeholder="0"
                    className="h-9 w-20 text-center"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={e.att}
                    onChange={(ev) => setEntry(z.id, { att: ev.target.value })}
                    placeholder="0"
                    className="h-9 w-20 text-center"
                  />
                </div>
              );
            })}
          </div>

          <Button onClick={logSession} disabled={busy || filledCount === 0} className="w-full font-bold mt-3">
            {busy ? <Loader2 className="animate-spin" /> : "Log session"}
          </Button>
        </div>
      </div>

      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mt-6 mb-2">History</h2>
      <div className="space-y-2">
        {sessions.map((s) => {
          const pct = s.attempts ? Math.round((s.makes / s.attempts) * 100) : 0;
          return (
            <div key={s.ts} className="rounded-xl bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {s.makes}/{s.attempts} · {pct}%
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(s.ts).toLocaleString()} · {s.rows.length} zone{s.rows.length > 1 ? "s" : ""}
                  </div>
                </div>
                {s.rating != null && (
                  <div className="text-right shrink-0">
                    <div className="text-display text-xl font-bold text-primary leading-none">{s.rating}</div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">rating</div>
                  </div>
                )}
                <button onClick={() => removeSession(s.ts)} className="text-muted-foreground p-2" aria-label="Delete session">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {s.rows.map((r) => {
                  const z = ZONES.find((zz) => zz.id === r.zone);
                  const rp = r.attempts ? Math.round((r.makes / r.attempts) * 100) : 0;
                  return (
                    <div key={r.id} className="text-[11px] text-muted-foreground flex justify-between">
                      <span className="truncate">{z?.label ?? r.zone}</span>
                      <span className="tabular-nums">
                        {r.makes}/{r.attempts} · {rp}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            No sessions yet — fill in the zones you shot and log your first session.
          </div>
        )}
      </div>
    </main>
  );
}
