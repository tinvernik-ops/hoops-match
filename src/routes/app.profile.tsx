import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, LogOut, Settings, Target, MessageSquare, Camera } from "lucide-react";
import { StatBarCard } from "@/components/stat-bar-card";
import { PLAYSTYLES } from "@/lib/playstyles";
import { useLang } from "@/hooks/use-lang";
import { uploadAvatar } from "@/lib/avatars";
import { splitDrillRatings } from "@/lib/shot-ratings";
import { PlayerBadges } from "@/components/player-badges";

const GAME_TYPES = ["1v1", "2v2", "3v3", "4v4", "5v5", "koth"] as const;
const GAME_TYPE_LABELS: Record<typeof GAME_TYPES[number], string> = {
  "1v1": "1v1", "2v2": "2v2", "3v3": "3v3", "4v4": "4v4", "5v5": "5v5", koth: "King of the Hill",
};

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

const schema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/),
  phone: z.string().trim().min(7).max(20).regex(/^[+\d\s().-]+$/),
  height_cm: z.number().int().min(120).max(250),
  vertical_cm: z.number().int().min(10).max(150).nullable(),
  weight_kg: z.number().int().min(30).max(250).nullable(),
  playstyle: z.string().trim().max(120).nullable(),
  preferred_game_type: z.enum(GAME_TYPES).nullable(),
});

function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: "", phone: "", height_cm: "", vertical_cm: "", weight_kg: "",
    playstyle: "", preferred_game_type: "" as "" | typeof GAME_TYPES[number],
  });

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const [{ data: profRaw, error }, { data: ratings, error: rErr }, { data: drills, error: dErr }] = await Promise.all([
        supabase.rpc("get_my_profile").maybeSingle(),
        supabase.from("ratings").select("offense,defense").eq("ratee_id", user!.id),
        supabase.from("shooting_drills").select("zone,makes,attempts").eq("user_id", user!.id),
      ]);
      const prof = profRaw as unknown as Database["public"]["Tables"]["profiles"]["Row"] | null;
      if (error) throw error;
      if (rErr) throw rErr;
      if (dErr) throw dErr;
      const n = ratings?.length ?? 0;
      const offense = n ? Math.round(ratings!.reduce((s, r) => s + r.offense, 0) / n) : null;
      const defense = n ? Math.round(ratings!.reduce((s, r) => s + r.defense, 0) / n) : null;
      const split = splitDrillRatings(drills ?? []);
      return {
        ...(prof ?? ({} as Database["public"]["Tables"]["profiles"]["Row"])),
        offense_avg: offense,
        defense_avg: defense,
        ratings_count: n,
        shot_rating: split.overall,
        three_rating: split.three,
        mid_rating: split.mid,
        total_attempts: split.totalAttempts,
        three_attempts: split.threeAttempts,
        mid_attempts: split.midAttempts,
      };
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username ?? "",
        phone: profile.phone ?? "",
        height_cm: profile.height_cm?.toString() ?? "",
        vertical_cm: profile.vertical_cm?.toString() ?? "",
        weight_kg: profile.weight_kg?.toString() ?? "",
        playstyle: (profile as { playstyle?: string | null }).playstyle ?? "",
        preferred_game_type: ((profile as { preferred_game_type?: typeof GAME_TYPES[number] | null }).preferred_game_type ?? "") as "" | typeof GAME_TYPES[number],
      });
    }
  }, [profile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const v = schema.parse({
        username: form.username,
        phone: form.phone,
        height_cm: Number(form.height_cm),
        vertical_cm: form.vertical_cm ? Number(form.vertical_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        playstyle: form.playstyle.trim() || null,
        preferred_game_type: form.preferred_game_type || null,
      });
      const { error } = await supabase.from("profiles").update(v).eq("id", user!.id);
      if (error) {
        if (error.code === "23505") {
          throw new Error("Username or phone already in use");
        }
        throw error;
      }
      toast.success(t("profile.saved"));
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : t("toast.failed");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h1 className="text-display text-2xl font-bold truncate">@{profile?.username}</h1>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Link to="/app/settings" className="grid place-items-center size-10 rounded-full bg-secondary shrink-0" aria-label={t("settings.title")}>
          <Settings className="size-5" />
        </Link>
      </header>

      <div className="mb-4">
        <StatBarCard
          initial={(profile?.username ?? "H").slice(0, 1).toUpperCase()}
          name={profile?.username ?? ""}
          defense={profile?.defense_avg ?? null}
          offense={profile?.offense_avg ?? null}
          avatarPath={(profile as { avatar_url?: string | null } | undefined)?.avatar_url ?? null}
        />
      </div>

      {profile?.shot_rating != null && (
        <Link to="/app/drills" className="mb-3 flex items-center gap-3 rounded-2xl bg-card p-4 border border-border/60">
          <div className="rating-ring grid place-items-center size-14 rounded-full shrink-0" style={{ ["--p" as string]: String(profile.shot_rating) }}>
            <div className="grid place-items-center size-11 rounded-full bg-card">
              <span className="text-display text-lg font-bold text-primary">{profile.shot_rating}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Shot rating</div>
            <div className="font-semibold">Updated after every drill session</div>
          </div>
          <Target className="size-5 text-muted-foreground" />
        </Link>
      )}

      {(profile?.three_rating != null || profile?.mid_rating != null) && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <ShotSplitCard label="3PT" value={profile?.three_rating ?? null} />
          <ShotSplitCard label="Mid-range" value={profile?.mid_rating ?? null} />
        </div>
      )}

      <div className="mb-4">
        <PlayerBadges
          offense={profile?.offense_avg ?? null}
          defense={profile?.defense_avg ?? null}
          ratingsCount={profile?.ratings_count ?? 0}
          shotRating={profile?.shot_rating ?? null}
          threeRating={profile?.three_rating ?? null}
          midRating={profile?.mid_rating ?? null}
          threeAttempts={profile?.three_attempts ?? 0}
          midAttempts={profile?.mid_attempts ?? 0}
          totalShotAttempts={profile?.total_attempts ?? 0}
        />
      </div>


      <AvatarUploader
        userId={user!.id}
        currentPath={(profile as { avatar_url?: string | null } | undefined)?.avatar_url ?? null}
        onUploaded={() => refetch()}
      />

      <Link
        to="/app/messages"
        className="mt-4 mb-6 flex items-center justify-center gap-2 w-full rounded-xl bg-secondary py-3 font-semibold"
      >
        <MessageSquare className="size-5" /> Messages
      </Link>

      <form onSubmit={onSave} className="space-y-4">
        <div>
          <Label htmlFor="username">{t("profile.username")}</Label>
          <Input id="username" maxLength={24} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="phone">{t("profile.phone")}</Label>
          <Input id="phone" type="tel" maxLength={20} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="height">{t("profile.height")}</Label>
          <Input id="height" type="number" min={120} max={250} value={form.height_cm}
            onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
            placeholder="185" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="vertical">{t("profile.vertical")}</Label>
            <Input id="vertical" type="number" min={10} max={150} value={form.vertical_cm}
              onChange={(e) => setForm({ ...form, vertical_cm: e.target.value })}
              placeholder={t("common.opt")} />
          </div>
          <div>
            <Label htmlFor="weight">{t("profile.weight")}</Label>
            <Input id="weight" type="number" min={30} max={250} value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
              placeholder={t("common.opt")} />
          </div>
        </div>
        <div>
          <Label>{t("profile.playstyle")} <span className="text-muted-foreground font-normal">({t("profile.visible")})</span></Label>
          <Select value={form.playstyle || undefined}
            onValueChange={(v) => setForm({ ...form, playstyle: v })}>
            <SelectTrigger><SelectValue placeholder={t("profile.pick_archetype")} /></SelectTrigger>
            <SelectContent>
              {PLAYSTYLES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("profile.preferred_game")} <span className="text-muted-foreground font-normal">({t("profile.visible")})</span></Label>
          <Select value={form.preferred_game_type || undefined}
            onValueChange={(v) => setForm({ ...form, preferred_game_type: v as typeof GAME_TYPES[number] })}>
            <SelectTrigger><SelectValue placeholder={t("profile.pick_one")} /></SelectTrigger>
            <SelectContent>
              {GAME_TYPES.map((g) => <SelectItem key={g} value={g}>{GAME_TYPE_LABELS[g]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 font-bold" size="lg">
          {busy ? <Loader2 className="animate-spin" /> : t("common.save")}
        </Button>
      </form>

      <Link to="/app/drills" className="mt-6 flex items-center justify-center gap-2 w-full rounded-xl bg-secondary py-4 font-semibold">
        <Target className="size-5" /> {t("profile.shooting_drills")}
      </Link>
      <Link to="/app/shooting-lab" className="mt-2 flex items-center justify-center gap-2 w-full rounded-xl bg-secondary py-4 font-semibold">
        <Camera className="size-5" /> Shooting Lab (AI form)
      </Link>

      <button
        onClick={signOut}
        className="mt-8 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <LogOut className="size-4" /> {t("profile.signout")}
      </button>
    </main>
  );
}

function AvatarUploader({ userId, currentPath, onUploaded }: { userId: string; currentPath: string | null; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }
    setBusy(true);
    try {
      await uploadAvatar(userId, file);
      toast.success("Profile picture updated");
      onUploaded();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {currentPath ? "Change profile picture" : "Add profile picture"}
      </button>
    </>
  );
}

function ShotSplitCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-card p-3 border border-border/60 flex items-center gap-3">
      <div className="rating-ring grid place-items-center size-12 rounded-full shrink-0" style={{ ["--p" as string]: String(value ?? 0) }}>
        <div className="grid place-items-center size-9 rounded-full bg-card">
          <span className="text-display text-sm font-bold text-primary">{value ?? "—"}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-xs font-semibold">rating</div>
      </div>
    </div>
  );
}
