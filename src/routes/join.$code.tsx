import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { joinLeagueByCode } from "@/lib/league-join.functions";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a Hoops league" },
      { name: "description", content: "You've been invited to a Hoops league." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

const PENDING_KEY = "pending_join_code";

function JoinPage() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const join = useServerFn(joinLeagueByCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return;
    if (!user) return;
    ran.current = true;
    (async () => {
      setBusy(true);
      try {
        const { leagueId } = await join({ data: { code } });
        sessionStorage.removeItem(PENDING_KEY);
        toast.success("Joined the league 🏀");
        nav({ to: "/app/leagues/$id", params: { id: leagueId } });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join league");
      } finally {
        setBusy(false);
      }
    })();
  }, [user, loading, code, join, nav]);

  function signInToJoin() {
    try {
      sessionStorage.setItem(PENDING_KEY, code);
    } catch {
      /* ignore */
    }
    nav({ to: "/auth" });
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-gradient-to-br from-primary to-rim text-primary-foreground mb-4">
          <Trophy className="size-8" />
        </div>
        <h1 className="text-display text-3xl font-bold">League invite</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Code <span className="font-mono font-bold text-primary">{code.toUpperCase()}</span>
        </p>

        {loading || busy ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Joining…
          </div>
        ) : error ? (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => nav({ to: "/app/leagues" })} className="w-full font-bold">
              Go to leagues
            </Button>
          </div>
        ) : !user ? (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in or create an account to join this league.
            </p>
            <Button onClick={signInToJoin} className="w-full h-12 font-bold text-base">
              Sign in to join
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
