import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, Loader2, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import { sendPushTo } from "@/lib/push";

export const Route = createFileRoute("/app/games/$gameId/verify")({
  component: VerifyGamePage,
});

type GameRow = {
  id: string;
  league_id: string;
  created_by: string;
  team_a_score: number;
  team_b_score: number;
  game_type: string;
  played_at: string;
  location: string | null;
};

type PlayerRow = {
  user_id: string;
  team: "A" | "B";
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  profile: { username: string | null } | null;
};

type VerificationRow = {
  id: string;
  user_id: string;
  score_status: "pending" | "approved" | "disputed";
  stats_status: "pending" | "approved" | "disputed" | "skipped";
  dispute_note: string | null;
};

function VerifyGamePage() {
  const { gameId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["game-verify", gameId],
    enabled: !!user,
    queryFn: async () => {
      const [g, gp, v] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase
          .from("game_players")
          .select("user_id, team, points, rebounds, assists, steals, blocks, profile:profiles!game_players_user_id_fkey(username)")
          .eq("game_id", gameId),
        supabase.from("game_verifications").select("*").eq("game_id", gameId),
      ]);
      if (g.error) throw g.error;
      if (gp.error) throw gp.error;
      if (v.error) throw v.error;
      return {
        game: g.data as GameRow,
        players: (gp.data ?? []) as unknown as PlayerRow[],
        verifications: (v.data ?? []) as VerificationRow[],
      };
    },
  });

  const myVerif = useMemo(
    () => data?.verifications.find((v) => v.user_id === user?.id) ?? null,
    [data, user]
  );
  const myPlayer = useMemo(
    () => data?.players.find((p) => p.user_id === user?.id) ?? null,
    [data, user]
  );

  async function respond(score: "approved" | "disputed", stats: "approved" | "disputed" | "skipped") {
    if (!user || !data) return;
    setBusy(true);
    const { error } = await supabase
      .from("game_verifications")
      .update({
        score_status: score,
        stats_status: stats,
        dispute_note: score === "disputed" || stats === "disputed" ? note.trim().slice(0, 500) || null : null,
        responded_at: new Date().toISOString(),
      })
      .eq("game_id", gameId)
      .eq("user_id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (score === "disputed" || stats === "disputed") {
      await sendPushTo({
        toUserId: data.game.created_by,
        title: "Game result disputed",
        body: `A player disputed the ${score === "disputed" ? "score" : "stats"}`,
        url: `/app/games/${gameId}/verify`,
        tag: `dispute-${gameId}`,
      });
      toast("Dispute sent to the game logger");
    } else {
      toast.success("Verified — thanks!");
    }
    refetch();
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-6">
        <div className="h-32 rounded-2xl bg-card animate-pulse" />
      </main>
    );
  }

  const { game, players, verifications } = data;
  const isInvolved = !!myPlayer;
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
  const totalPlayers = players.length;
  const approved = verifications.filter((v) => v.score_status === "approved").length;
  const disputed = verifications.filter((v) => v.score_status === "disputed").length;
  const pending = totalPlayers - approved - disputed;
  const overall =
    disputed > 0 ? "disputed" : pending === 0 ? "verified" : "pending";

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-8">
      <button
        onClick={() => nav({ to: "/app/leagues/$id", params: { id: game.league_id } })}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="size-4" /> Back to league
      </button>

      <h1 className="text-display text-3xl font-bold">Verify game</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {new Date(game.played_at).toLocaleString()} · {game.game_type.toUpperCase()}
        {game.location ? ` · ${game.location}` : ""}
      </p>

      <section className="rounded-2xl bg-card p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <ScoreCard label="Team A" score={game.team_a_score} win={game.team_a_score > game.team_b_score} />
          <ScoreCard label="Team B" score={game.team_b_score} win={game.team_b_score > game.team_a_score} />
        </div>
        <StatusBadge status={overall} approved={approved} disputed={disputed} total={totalPlayers} />
      </section>

      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Players</h2>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <TeamCol label="Team A" players={teamA} verifications={verifications} />
        <TeamCol label="Team B" players={teamB} verifications={verifications} />
      </div>

      {isInvolved && myVerif && (
        <section className="rounded-2xl bg-card p-4">
          <h2 className="font-bold mb-1">Your verification</h2>
          {myVerif.score_status === "pending" ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Confirm the score is correct. Stats are optional — skip if you didn't track them.
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note if you're disputing (optional)"
                maxLength={500}
                className="mb-3 min-h-[60px]"
              />
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={() => respond("approved", "approved")} disabled={busy} className="h-12 font-bold">
                  {busy ? <Loader2 className="animate-spin" /> : <><Check className="size-4 mr-1" /> Approve score & stats</>}
                </Button>
                <Button onClick={() => respond("approved", "skipped")} disabled={busy} variant="secondary" className="h-12 font-bold">
                  <Check className="size-4 mr-1" /> Approve score only
                </Button>
                <Button onClick={() => respond("disputed", "disputed")} disabled={busy} variant="destructive" className="h-12 font-bold">
                  <X className="size-4 mr-1" /> Dispute
                </Button>
              </div>
            </>
          ) : (
            <div className="text-sm">
              You{" "}
              <span className={myVerif.score_status === "approved" ? "text-primary font-bold" : "text-destructive font-bold"}>
                {myVerif.score_status}
              </span>{" "}
              this game.
              {myVerif.dispute_note && <div className="mt-2 text-xs text-muted-foreground">"{myVerif.dispute_note}"</div>}
              <Link to="/app/leagues/$id" params={{ id: game.league_id }} className="block mt-3 text-xs text-primary underline">
                Back to league
              </Link>
            </div>
          )}
        </section>
      )}

      {!isInvolved && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          You weren't a player in this game.
        </p>
      )}
    </main>
  );
}

function ScoreCard({ label, score, win }: { label: string; score: number; win: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${win ? "bg-primary/10 border-2 border-primary" : "bg-secondary border-2 border-transparent"}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-display text-4xl font-black text-primary mt-1">{score}</div>
    </div>
  );
}

function StatusBadge({
  status,
  approved,
  disputed,
  total,
}: {
  status: "verified" | "pending" | "disputed";
  approved: number;
  disputed: number;
  total: number;
}) {
  if (status === "verified") {
    return (
      <div className="flex items-center gap-2 text-sm font-bold text-primary">
        <ShieldCheck className="size-4" /> Verified by all {total} players
      </div>
    );
  }
  if (status === "disputed") {
    return (
      <div className="flex items-center gap-2 text-sm font-bold text-destructive">
        <ShieldAlert className="size-4" /> Disputed ({disputed} of {total})
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
      <Clock className="size-4" /> Pending — {approved}/{total} approved
    </div>
  );
}

function TeamCol({
  label,
  players,
  verifications,
}: {
  label: string;
  players: PlayerRow[];
  verifications: VerificationRow[];
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <ul className="space-y-1.5">
        {players.map((p) => {
          const v = verifications.find((x) => x.user_id === p.user_id);
          const icon =
            v?.score_status === "approved" ? (
              <Check className="size-3.5 text-primary" />
            ) : v?.score_status === "disputed" ? (
              <X className="size-3.5 text-destructive" />
            ) : (
              <Clock className="size-3.5 text-muted-foreground" />
            );
          return (
            <li key={p.user_id} className="flex items-center gap-1.5 text-sm">
              {icon}
              <span className="truncate">@{p.profile?.username ?? "player"}</span>
            </li>
          );
        })}
        {players.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}
