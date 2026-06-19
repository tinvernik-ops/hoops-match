import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useLang, LANGUAGES } from "@/hooks/use-lang";
import { useRadius } from "@/hooks/use-radius";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Sun, Moon, Check, MapPin, Users, Bell } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const { courtsKm, hoopersKm, setCourtsKm, setHoopersKm } = useRadius();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: prefs, refetch } = useQuery({
    queryKey: ["court-alert-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("court_alert_threshold, court_alert_radius_km")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { court_alert_threshold: number; court_alert_radius_km: number } | null;
    },
    enabled: !!user,
  });

  const [threshold, setThreshold] = useState(3);
  const [alertKm, setAlertKm] = useState(10);
  useEffect(() => {
    if (prefs) {
      setThreshold(prefs.court_alert_threshold);
      setAlertKm(Number(prefs.court_alert_radius_km));
    }
  }, [prefs]);

  async function saveAlertPrefs(next: { threshold?: number; alertKm?: number }) {
    if (!user) return;
    const payload: Record<string, number> = {};
    if (next.threshold != null) payload.court_alert_threshold = next.threshold;
    if (next.alertKm != null) payload.court_alert_radius_km = next.alertKm;
    await supabase.from("profiles").update(payload).eq("id", user.id);
    refetch();
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 space-y-6">
      <button onClick={() => nav({ to: "/app/profile" })} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {t("common.back")}
      </button>

      <h1 className="text-display text-3xl font-bold">{t("settings.title")}</h1>

      <section className="rounded-2xl bg-card p-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{t("settings.appearance")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <ThemeOption
            label={t("settings.day")}
            icon={<Sun className="size-6" />}
            active={theme === "light"}
            onClick={() => setTheme("light")}
          />
          <ThemeOption
            label={t("settings.night")}
            icon={<Moon className="size-6" />}
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-4 space-y-5">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{t("settings.radius")}</h2>

        <RadiusSlider
          icon={<MapPin className="size-4" />}
          label={t("settings.radius.courts")}
          value={courtsKm}
          onChange={setCourtsKm}
        />
        <RadiusSlider
          icon={<Users className="size-4" />}
          label={t("settings.radius.hoopers")}
          value={hoopersKm}
          onChange={setHoopersKm}
        />
      </section>

      <section className="rounded-2xl bg-card p-4 space-y-5">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Bell className="size-3" /> Court alerts
        </h2>
        <p className="text-xs text-muted-foreground -mt-3">
          Get a push when a court near you reaches this many hoopers.
        </p>
        <RadiusSlider
          icon={<Users className="size-4" />}
          label="Alert when court has"
          value={threshold}
          onChange={(n) => { setThreshold(n); saveAlertPrefs({ threshold: n }); }}
          min={2}
          max={10}
          unit="hoopers"
        />
        <RadiusSlider
          icon={<MapPin className="size-4" />}
          label="Alert radius"
          value={alertKm}
          onChange={(n) => { setAlertKm(n); saveAlertPrefs({ alertKm: n }); }}
          min={1}
          max={50}
        />
      </section>

      <section className="rounded-2xl bg-card p-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{t("settings.language")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => {
            const active = lang === l.code;
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-secondary"
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <span className="flex-1 text-left">{l.name}</span>
                {active && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function RadiusSlider({
  icon, label, value, onChange, min = 1, max = 50, unit = "km",
}: { icon: React.ReactNode; label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; unit?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon} {label}
        </span>
        <span className="text-display text-xl font-bold text-primary">{value} {unit}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function RadiusSlider({
  icon, label, value, onChange,
}: { icon: React.ReactNode; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon} {label}
        </span>
        <span className="text-display text-xl font-bold text-primary">{value} km</span>
      </div>
      <Slider value={[value]} min={1} max={50} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ThemeOption({
  label, icon, active, onClick,
}: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl py-5 transition border-2 ${
        active ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-secondary text-foreground"
      }`}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
