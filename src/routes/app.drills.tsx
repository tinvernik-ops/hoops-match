import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const drillSchema = z.object({
  attempts: z.number().int().min(1).max(999),
  makes: z.number().int().min(0).max(999),
});

function DrillsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [selected, setSelected] = useState<Zone>(ZONES[0]);
  const [made, setMade] = useState("");
  const [att, setAtt] = useState("");
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

  async function logShot() {
    if (!user) return;
    try {
      const v = drillSchema.parse({ attempts: Number(att), makes: Number(made) });
      if (v.makes > v.attempts) throw new Error("Makes can't exceed attempts");
      setBusy(true);
      const { error } = await supabase.from("shooting_drills").insert({
        user_id: user.id,
        zone: selected.id,
        x: selected.x,
        y: selected.y,
        attempts: v.attempts,
        makes: v.makes,
      });
      if (error) throw error;
      setMade(""); setAtt("");
      toast.success("Drill logged");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("shooting_drills").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); refetch(); }
  }

  function pctColor(pct: number) {
    if (pct >= 60) return "fill-primary";
    if (pct >= 40) return "fill-rim";
    return "fill-muted";
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4">
      <button onClick={() => nav({ to: "/app/profile" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Profile
      </button>

      <h1 className="text-display text-3xl font-bold">Shooting drills</h1>
      <p className="text-xs text-muted-foreground mb-4">Private — only you see this.</p>

      <div className="rounded-2xl bg-card p-3">
        <svg viewBox="0 0 100 100" className="w-full aspect-square select-none">
          {/* Court */}
          <rect x="0" y="0" width="100" height="100" rx="2" className="fill-secondary" />
          {/* 3pt arc */}
          <path d="M 8,100 L 8,80 A 42,42 0 0 1 92,80 L 92,100" fill="none" className="stroke-border" strokeWidth="0.6" />
          {/* Paint */}
          <rect x="35" y="65" width="30" height="35" fill="none" className="stroke-border" strokeWidth="0.6" />
          {/* FT circle */}
          <circle cx="50" cy="65" r="8" fill="none" className="stroke-border" strokeWidth="0.6" />
          {/* Rim */}
          <circle cx="50" cy="90" r="2" fill="none" className="stroke-primary" strokeWidth="0.8" />
          <line x1="42" y1="93" x2="58" y2="93" className="stroke-primary" strokeWidth="0.8" />

          {/* Zone markers */}
          {ZONES.map((z) => {
            const t = totals.get(z.id);
            const pct = t && t.attempts > 0 ? Math.round((t.makes / t.attempts) * 100) : null;
            const isSel = selected.id === z.id;
            return (
              <g key={z.id} onClick={() => setSelected(z)} className="cursor-pointer">
                <circle cx={z.x} cy={z.y} r={isSel ? 5.2 : 4}
                  className={pct != null ? pctColor(pct) : "fill-card"}
                  stroke={isSel ? "white" : "currentColor"} strokeWidth={isSel ? 0.9 : 0.4} />
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
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected zone</div>
          <div className="text-display text-xl font-bold">{selected.label}</div>
          {(() => {
            const t = totals.get(selected.id);
            if (!t || t.attempts === 0) return <div className="text-xs text-muted-foreground">No attempts yet</div>;
            return (
              <div className="text-xs text-muted-foreground">
                {t.makes}/{t.attempts} · {Math.round((t.makes / t.attempts) * 100)}%
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <Label htmlFor="made">Made</Label>
              <Input id="made" type="number" min={0} max={999} value={made}
                onChange={(e) => setMade(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="att">Attempts</Label>
              <Input id="att" type="number" min={1} max={999} value={att}
                onChange={(e) => setAtt(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button onClick={logShot} disabled={busy} className="w-full font-bold mt-3">
            {busy ? <Loader2 className="animate-spin" /> : "Log shots"}
          </Button>
        </div>
      </div>

      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mt-6 mb-2">History</h2>
      <div className="space-y-2">
        {(drills ?? []).map((d) => {
          const z = ZONES.find((zz) => zz.id === d.zone);
          const pct = d.attempts ? Math.round((d.makes / d.attempts) * 100) : 0;
          return (
            <div key={d.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{z?.label ?? d.zone}</div>
                <div className="text-[11px] text-muted-foreground">
                  {d.makes}/{d.attempts} · {pct}% · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => remove(d.id)} className="text-muted-foreground p-2" aria-label="Delete">
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
        {(!drills || drills.length === 0) && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            No drills yet — pick a spot and log your first set.
          </div>
        )}
      </div>
    </main>
  );
}
