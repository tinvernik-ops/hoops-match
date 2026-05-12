import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ensurePushSubscription } from "@/lib/push";
import { Home, User, Trophy } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (user) ensurePushSubscription(user.id).catch(() => {});
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const tabs = [
    { to: "/app", label: "Court", icon: Home, exact: true },
    { to: "/app/leagues", label: "Leagues", icon: Trophy, exact: false },
    { to: "/app/profile", label: "Profile", icon: User, exact: false },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <Outlet />
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md grid grid-cols-3">
          {tabs.map((t) => {
            const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={`flex flex-col items-center gap-1 py-3 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                <t.icon className="size-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
