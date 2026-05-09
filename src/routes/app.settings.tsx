import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { ArrowLeft, Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const nav = useNavigate();

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4">
      <button onClick={() => nav({ to: "/app/profile" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Back
      </button>

      <h1 className="text-display text-3xl font-bold mb-6">Settings</h1>

      <section className="rounded-2xl bg-card p-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Appearance</h2>
        <div className="grid grid-cols-2 gap-3">
          <ThemeOption
            label="Day mode"
            icon={<Sun className="size-6" />}
            active={theme === "light"}
            onClick={() => setTheme("light")}
          />
          <ThemeOption
            label="Night mode"
            icon={<Moon className="size-6" />}
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
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
