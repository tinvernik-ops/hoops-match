import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchLeagueData, buildLeaderboard, buildTeamRecords, type GameType } from "@/lib/leagues";
import { supabase } from "@/integrations/supabase/client";
import { fromPublicProfiles } from "@/lib/public-profiles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Copy, Trophy, UserPlus, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { sendPushTo } from "@/lib/push";

export const Route = createFileRoute("/app/leagues/$id/")({
  component: LeagueDetail,
});

const GAME_TYPES: GameType[] = ["1v1", "2v2", "3v3", "4v4", "5v5", "koth"];
// Game-type leaderboards exist for everything except KOTH per the user spec.
const RECORD_TYPES: GameType[] = ["1v1", "2v2", "3v3", "4v4", "5v5"];
const GAME_TYPE_LABEL: Record<GameType | "all", string> = {
  all: "All", "1v1": "1v1", "2v2": "2v2", "3v3": "3v3", "4v4": "4v4", "5v5": "5v5", koth: "KOTH",
};

function LeagueDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [filter, setFilter] = useState<GameType | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["league", id],
    queryFn: () => fetchLeagueData(id),
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!data) return null;
    const games = filter === "all" ? data.games : data.games.filter((g) => g.game_type === filter);
    const gameIds = new Set(games.map((g) => g.id));
    const gamePlayers = data.gamePlayers.filter((gp) => gameIds.has(gp.game_id));
    return { games, gamePlayers };
  }, [data, filter]);

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!data.league) return <div className="p-6">League not found.</div>;

  const leaderboard = buildLeaderboard(data.members, filtered!.games, filtered!.gamePlayers);
  const teams = buildTeamRecords(data.members, filtered!.games, filtered!.gamePlayers);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4">
      <button onClick={() => nav({ to: "/app/leagues" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Leagues
      </button>

      <header className="rounded-2xl bg-card p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center size-12 rounded-xl bg-gradient-to-br from-primary to-rim text-primary-foreground">
            <Trophy className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-display text-2xl font-bold truncate">{data.league.name}</h1>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(data.league!.join_code);
                toast.success("Code copied");
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Code <span className="font-mono font-bold text-primary">{data.league.join_code}</span>
              <Copy className="size-3" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link
            to="/app/leagues/$id/log"
            params={{ id }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold"
          >
            <Plus className="size-4" /> Log
          </Link>
          <Link
            to="/app/leagues/$id/chat"
            params={{ id }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-secondary text-secondary-foreground py-3 text-sm font-bold"
          >
            <MessageSquare className="size-4" /> Chat
          </Link>
          {data.league.owner_id === user?.id ? (
            <InviteDialog leagueId={id} memberIds={data.members.map((m) => m.user_id)} />
          ) : (
            <div />
          )}
        </div>
      </header>

      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Game type</div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...GAME_TYPES] as const).map((g) => (
            <button key={g} onClick={() => setFilter(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                filter === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
              {GAME_TYPE_LABEL[g]}
            </button>
          ))}
        </div>
        {filter !== "all" && filter !== "koth" && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Showing {GAME_TYPE_LABEL[filter]} leaderboard only.
          </p>
        )}
        {filter === "koth" && (
          <p className="text-[11px] text-muted-foreground mt-2">
            King of the Hill — individual stats only, no team records.
          </p>
        )}
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="leaderboard">{filter === "1v1" ? "Record" : "Players"}</TabsTrigger>
          <TabsTrigger value="teams" disabled={filter === "koth" || filter === "1v1"}>Teams</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          {filter === "1v1"
            ? <RecordLeaderboard rows={leaderboard} />
            : <PlayerLeaderboard rows={leaderboard} />}
        </TabsContent>
        <TabsContent value="teams">
          <TeamLeaderboard rows={teams} />
        </TabsContent>
        <TabsContent value="games">
          <GamesList games={filtered!.games} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function PlayerLeaderboard({ rows }: { rows: ReturnType<typeof buildLeaderboard> }) {
  const [sort, setSort] = useState<"points" | "rebounds" | "assists" | "steals" | "blocks" | "wins">("points");
  const sorted = [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number));

  if (rows.length === 0) {
    return <Empty msg="No stats yet — log your first game." />;
  }

  return (
    <div>
      <div className="flex gap-1 my-3 text-xs overflow-x-auto -mx-1 px-1">
        {(["points", "rebounds", "assists", "steals", "blocks", "wins"] as const).map((s) => (
          <button key={s} onClick={() => setSort(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full uppercase tracking-wider font-semibold ${sort === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {sorted.map((r, i) => (
          <div key={r.user_id} className="flex items-center gap-3 rounded-xl bg-card p-3">
            <div className="text-display text-2xl font-bold text-muted-foreground w-7 text-center">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">@{r.username}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.games}G · {r.wins}-{r.losses} · {r.points}p / {r.rebounds}r / {r.assists}a
              </div>
            </div>
            <div className="text-display text-2xl font-bold text-primary">{r[sort]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamLeaderboard({ rows }: { rows: ReturnType<typeof buildTeamRecords> }) {
  if (rows.length === 0) return <Empty msg="No team records yet." />;
  return (
    <div className="space-y-2 mt-3">
      {rows.map((t) => (
        <div key={t.members.join(",")} className="rounded-xl bg-card p-3">
          <div className="flex items-baseline justify-between">
            <div className="font-semibold truncate">{t.usernames.map((u) => "@" + u).join(" + ")}</div>
            <div className="text-display text-xl font-bold text-primary shrink-0 ml-2">{t.wins}-{t.losses}</div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {t.games}G · {t.pointsFor} pts for · {t.pointsAgainst} pts against
          </div>
        </div>
      ))}
    </div>
  );
}

function GamesList({ games }: { games: ReturnType<typeof buildLeaderboard> extends never ? never : Awaited<ReturnType<typeof fetchLeagueData>>["games"] }) {
  if (games.length === 0) return <Empty msg="No games logged yet." />;
  return (
    <div className="space-y-2 mt-3">
      {games.map((g) => {
        const aWin = g.team_a_score > g.team_b_score;
        return (
          <div key={g.id} className="rounded-xl bg-card p-3">
            <div className="flex items-center justify-between">
              <span className={`text-display text-xl font-bold ${aWin ? "text-primary" : "text-muted-foreground"}`}>
                Team A · {g.team_a_score}
              </span>
              <span className="text-xs text-muted-foreground">vs</span>
              <span className={`text-display text-xl font-bold ${!aWin ? "text-primary" : "text-muted-foreground"}`}>
                {g.team_b_score} · Team B
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-bold uppercase tracking-wider">
                {g.game_type === "koth" ? "KOTH" : g.game_type}
              </span>
              <span>{new Date(g.played_at).toLocaleDateString()} {g.location ? `· ${g.location}` : ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground mt-3">{msg}</div>;
}

function InviteDialog({ leagueId, memberIds }: { leagueId: string; memberIds: string[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: results = [], refetch } = useQuery({
    queryKey: ["invite-search", leagueId, q],
    queryFn: async () => {
      const term = q.trim();
      if (term.length < 2) return [] as Array<{ id: string; username: string }>;
      const { data, error } = await fromPublicProfiles<{ id: string; username: string }>()
        .select("id, username")
        .ilike("username", `%${term}%`)
        .limit(10);
      if (error) throw error;
      return (data ?? []).filter((p) => p.id !== user?.id && !memberIds.includes(p.id));
    },
    enabled: open,
  });

  async function invite(toId: string) {
    if (!user) return;
    setBusyId(toId);
    const { error } = await supabase
      .from("league_invites")
      .insert({ league_id: leagueId, from_id: user.id, to_id: toId });
    setBusyId(null);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already invited" : error.message);
      return;
    }
    sendPushTo({ toUserId: toId, title: "🏆 League invite", body: "You've been invited to a Hoops league.", url: "/app/leagues", tag: `league-${leagueId}` });
    toast.success("Invite sent");
    refetch();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-1.5 font-bold text-sm">
          <UserPlus className="size-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite players</DialogTitle></DialogHeader>
        <Input placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Type at least 2 characters.</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No matching users.</p>
          ) : (
            results.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                <div className="grid place-items-center size-9 rounded-full bg-primary text-primary-foreground font-bold">
                  {r.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 font-semibold truncate">@{r.username}</div>
                <Button size="sm" disabled={busyId === r.id} onClick={() => invite(r.id)}>
                  {busyId === r.id ? <Loader2 className="size-4 animate-spin" /> : "Invite"}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
