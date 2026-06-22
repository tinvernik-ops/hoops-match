import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Square, Check, X, Trash2 } from "lucide-react";
import { getPoseLandmarker, LM, angleDeg, emptyMetrics, scoreForm, type FormMetrics } from "@/lib/pose";

export const Route = createFileRoute("/app/shooting-lab")({
  component: ShootingLabPage,
});

type Session = {
  id: string;
  made: boolean;
  court_x: number;
  court_y: number;
  form_score: number | null;
  form_metrics: FormMetrics;
  notes: string | null;
  created_at: string;
};

function ShootingLabPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const metricsRef = useRef<FormMetrics>(emptyMetrics());
  const followStartRef = useRef<number | null>(null);
  const [analyzed, setAnalyzed] = useState<{ metrics: FormMetrics; score: number; notes: string[] } | null>(null);

  // Tag step
  const [pendingTag, setPendingTag] = useState<{ x: number; y: number } | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["shooting-sessions", user?.id],
    queryFn: async (): Promise<Session[]> => {
      const { data, error } = await supabase
        .from("shooting_sessions")
        .select("id,made,court_x,court_y,form_score,form_metrics,notes,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Session[];
    },
    enabled: !!user,
  });

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  async function startCamera() {
    setLoading(true);
    try {
      await getPoseLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    metricsRef.current = emptyMetrics();
    followStartRef.current = null;
    setAnalyzed(null);
    setRecording(true);
    const landmarker = await getPoseLandmarker();
    const canvas = canvasRef.current!;
    const video = videoRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 640;

    const loop = () => {
      if (!recordingRef.current || !videoRef.current) return;
      const ts = performance.now();
      const result = landmarker.detectForVideo(video, ts);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const lms = result.landmarks?.[0];
      if (lms) {
        // Use right side by default (most shooters); could be smarter
        const rs = lms[LM.RIGHT_SHOULDER], re = lms[LM.RIGHT_ELBOW], rw = lms[LM.RIGHT_WRIST];
        const rh = lms[LM.RIGHT_HIP], rk = lms[LM.RIGHT_KNEE], ra = lms[LM.RIGHT_ANKLE];
        if (rs && re && rw) {
          const elbow = angleDeg(rs, re, rw);
          metricsRef.current.maxElbowAngle = Math.max(metricsRef.current.maxElbowAngle, elbow);
          // Wrist height: track lowest y observed (= highest physically)
          metricsRef.current.releaseWristHeight = Math.min(metricsRef.current.releaseWristHeight, rw.y);
          // Follow-through window: wrist above shoulder
          if (rw.y < rs.y - 0.05) {
            if (followStartRef.current == null) followStartRef.current = ts;
            metricsRef.current.followThroughMs = Math.max(
              metricsRef.current.followThroughMs,
              ts - followStartRef.current,
            );
          } else {
            followStartRef.current = null;
          }
        }
        if (rh && rk && ra) {
          const knee = angleDeg(rh, rk, ra);
          metricsRef.current.minKneeAngle = Math.min(metricsRef.current.minKneeAngle, knee);
        }
        metricsRef.current.frames++;

        // Draw skeleton lines
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 3;
        const drawLine = (a: number, b: number) => {
          const A = lms[a], B = lms[b];
          if (!A || !B) return;
          ctx.beginPath();
          ctx.moveTo(A.x * canvas.width, A.y * canvas.height);
          ctx.lineTo(B.x * canvas.width, B.y * canvas.height);
          ctx.stroke();
        };
        drawLine(LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW);
        drawLine(LM.RIGHT_ELBOW, LM.RIGHT_WRIST);
        drawLine(LM.RIGHT_SHOULDER, LM.RIGHT_HIP);
        drawLine(LM.RIGHT_HIP, LM.RIGHT_KNEE);
        drawLine(LM.RIGHT_KNEE, LM.RIGHT_ANKLE);
        drawLine(LM.LEFT_SHOULDER, LM.LEFT_HIP);
        drawLine(LM.LEFT_HIP, LM.LEFT_KNEE);
        drawLine(LM.LEFT_KNEE, LM.LEFT_ANKLE);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    recordingRef.current = true;
    loop();
  }

  const recordingRef = useRef(false);

  function stopRecording() {
    recordingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRecording(false);
    const m = metricsRef.current;
    if (m.frames < 5) {
      toast.error("Not enough frames captured. Try again with better lighting.");
      return;
    }
    const { score, notes } = scoreForm(m);
    setAnalyzed({ metrics: m, score, notes });
  }

  function handleCourtTap(e: React.MouseEvent<SVGSVGElement>) {
    if (!analyzed) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingTag({ x, y });
  }

  async function saveShot(made: boolean) {
    if (!analyzed || !pendingTag || !user) return;
    const { error } = await supabase.from("shooting_sessions").insert({
      user_id: user.id,
      made,
      court_x: pendingTag.x,
      court_y: pendingTag.y,
      form_metrics: JSON.parse(JSON.stringify(analyzed.metrics)),
      form_score: analyzed.score,
      notes: analyzed.notes.join(" • "),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(made ? "Make logged 🟢" : "Miss logged 🔴");
    setAnalyzed(null);
    setPendingTag(null);
    metricsRef.current = emptyMetrics();
    qc.invalidateQueries({ queryKey: ["shooting-sessions", user.id] });
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from("shooting_sessions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["shooting-sessions", user?.id] });
  }

  const made = sessions.filter((s) => s.made).length;
  const total = sessions.length;
  const pct = total ? Math.round((made / total) * 100) : 0;

  return (
    <main className="min-h-dvh bg-background text-foreground pb-24">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/app/profile" className="p-2 -ml-2"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-bold flex-1">Shooting Lab</h1>
        <span className="text-sm text-muted-foreground">{made}/{total} · {pct}%</span>
      </header>

      <section className="p-4">
        <div className="relative w-full max-h-[50vh] aspect-[3/4] mx-auto rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-4">
              <Camera className="size-10 opacity-70" />
              <p className="text-xs opacity-80 text-center">
                Prop your phone sideways. The AI tracks your elbow, knees, and release.
              </p>
              <Button onClick={startCamera} disabled={loading} size="lg" className="font-bold">
                {loading ? <Loader2 className="animate-spin" /> : "Start camera"}
              </Button>
            </div>
          )}
          {ready && recording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              <span className="size-2 rounded-full bg-white animate-pulse" /> REC
            </div>
          )}
        </div>
      </section>

      {/* Sticky action bar — always visible above bottom tab nav */}
      {ready && !analyzed && (
        <div className="sticky bottom-20 z-20 px-4">
          {!recording ? (
            <Button onClick={startRecording} className="w-full h-14 font-black text-base shadow-lg" size="lg">
              ● Record shot
            </Button>
          ) : (
            <Button onClick={stopRecording} variant="destructive" className="w-full h-14 font-black text-base shadow-lg" size="lg">
              <Square className="size-5 mr-2" /> Stop & analyze
            </Button>
          )}
        </div>
      )}

      {analyzed && (
        <section className="px-4">
          <div className="rounded-2xl border border-border p-4 bg-card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold">Form analysis</h2>
              <div className={`text-2xl font-black ${analyzed.score >= 75 ? "text-green-500" : analyzed.score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                {analyzed.score}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
              <div>Elbow ext: <span className="text-foreground font-semibold">{Math.round(analyzed.metrics.maxElbowAngle)}°</span></div>
              <div>Knee bend: <span className="text-foreground font-semibold">{Math.round(analyzed.metrics.minKneeAngle)}°</span></div>
              <div>Release height: <span className="text-foreground font-semibold">{Math.round((1 - analyzed.metrics.releaseWristHeight) * 100)}%</span></div>
              <div>Follow-thru: <span className="text-foreground font-semibold">{Math.round(analyzed.metrics.followThroughMs)}ms</span></div>
            </div>
            <ul className="text-sm space-y-1 mb-4">
              {analyzed.notes.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>

            <p className="text-sm font-semibold mb-2">Tap on the court where you shot from:</p>
            <HalfCourt sessions={[]} onTap={handleCourtTap} pendingTag={pendingTag} />

            {pendingTag && (
              <div className="mt-3 flex gap-2">
                <Button onClick={() => saveShot(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12">
                  <Check className="size-4 mr-1" /> Made
                </Button>
                <Button onClick={() => saveShot(false)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-12">
                  <X className="size-4 mr-1" /> Miss
                </Button>
              </div>
            )}
            <button onClick={() => { setAnalyzed(null); setPendingTag(null); }} className="mt-2 text-xs text-muted-foreground w-full text-center py-2">
              Discard this shot
            </button>
          </div>
        </section>
      )}

      <section className="px-4 mt-6">
        <h2 className="font-bold mb-2">Shot chart</h2>
        <HalfCourt sessions={sessions} />
      </section>

      <section className="px-4 mt-6 space-y-2">
        <h2 className="font-bold">Recent shots</h2>
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">No shots logged yet.</p>}
        {sessions.slice(0, 20).map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <span className={`size-3 rounded-full ${s.made ? "bg-green-500" : "bg-red-500"}`} />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{s.made ? "Made" : "Miss"} · score {s.form_score ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{s.notes ?? ""}</div>
            </div>
            <button onClick={() => deleteSession(s.id)} className="p-2 text-muted-foreground">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

function HalfCourt({
  sessions,
  onTap,
  pendingTag,
}: {
  sessions: Session[];
  onTap?: (e: React.MouseEvent<SVGSVGElement>) => void;
  pendingTag?: { x: number; y: number } | null;
}) {
  // viewBox 500 x 470 = half-court
  return (
    <svg
      viewBox="0 0 500 470"
      onClick={onTap}
      className={`w-full rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-border ${onTap ? "cursor-crosshair" : ""}`}
    >
      {/* court outline */}
      <rect x="2" y="2" width="496" height="466" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      {/* paint */}
      <rect x="170" y="2" width="160" height="190" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      {/* free throw circle */}
      <circle cx="250" cy="192" r="60" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      {/* rim */}
      <circle cx="250" cy="50" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8" />
      {/* backboard */}
      <line x1="220" y1="35" x2="280" y2="35" stroke="currentColor" strokeWidth="3" opacity="0.8" />
      {/* 3pt arc — approx NBA */}
      <path d="M 30 2 L 30 140 A 220 220 0 0 0 470 140 L 470 2" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      {/* restricted area */}
      <path d="M 210 50 A 40 40 0 0 0 290 50" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />

      {sessions.map((s) => (
        <circle
          key={s.id}
          cx={s.court_x * 500}
          cy={s.court_y * 470}
          r="7"
          fill={s.made ? "#22c55e" : "#ef4444"}
          opacity="0.75"
        />
      ))}
      {pendingTag && (
        <circle cx={pendingTag.x * 500} cy={pendingTag.y * 470} r="10" fill="none" stroke="#3b82f6" strokeWidth="3" />
      )}
    </svg>
  );
}
