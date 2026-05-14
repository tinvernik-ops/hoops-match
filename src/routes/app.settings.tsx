import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { useLang, LANGUAGES } from "@/hooks/use-lang";
import { ArrowLeft, Sun, Moon, Check } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 space-y-6">
      <button onClick={() => nav({ to: "/app/profile" })} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Back
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
