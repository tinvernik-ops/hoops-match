import { supabase } from "@/integrations/supabase/client";

export type LeagueRow = {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
};

export type Member = { user_id: string; username: string };

export type GameRow = {
  id: string;
  league_id: string;
  played_at: string;
  location: string | null;
  team_a_score: number;
  team_b_score: number;
  notes: string | null;
  created_by: string;
};

export type GamePlayerRow = {
  id: string;
  game_id: string;
  user_id: string;
  team: "A" | "B";
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
};

export async function fetchMyLeagues(userId: string): Promise<LeagueRow[]> {
  const { data: memberships, error } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);
  if (error) throw error;
  const ids = (memberships ?? []).map((m) => m.league_id);
  if (ids.length === 0) return [];
  const { data, error: lErr } = await supabase
    .from("leagues")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (lErr) throw lErr;
  return data ?? [];
}

export type LeaderboardRow = {
  user_id: string;
  username: string;
  games: number;
  wins: number;
  losses: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
};

export type TeamRecord = {
  members: string[]; // sorted user_ids forming the team key
  usernames: string[];
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

export async function fetchLeagueData(leagueId: string) {
  const [{ data: league, error: lErr }, { data: members, error: mErr }, { data: games, error: gErr }] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", leagueId).maybeSingle(),
    supabase.from("league_members").select("user_id, profiles!inner(username)").eq("league_id", leagueId),
    supabase.from("games").select("*").eq("league_id", leagueId).order("played_at", { ascending: false }),
  ]);
  if (lErr) throw lErr;
  if (mErr) throw mErr;
  if (gErr) throw gErr;

  const memberList: Member[] = (members ?? []).map((m: { user_id: string; profiles: { username: string } | null }) => ({
    user_id: m.user_id,
    username: m.profiles?.username ?? "?",
  }));

  let gamePlayers: GamePlayerRow[] = [];
  if ((games ?? []).length > 0) {
    const { data: gp, error: gpErr } = await supabase
      .from("game_players")
      .select("*")
      .in("game_id", games!.map((g) => g.id));
    if (gpErr) throw gpErr;
    gamePlayers = gp ?? [];
  }

  return { league, members: memberList, games: games ?? [], gamePlayers };
}

export function buildLeaderboard(
  members: Member[],
  games: GameRow[],
  gamePlayers: GamePlayerRow[]
): LeaderboardRow[] {
  const usernameById = new Map(members.map((m) => [m.user_id, m.username]));
  const gameById = new Map(games.map((g) => [g.id, g]));
  const acc = new Map<string, LeaderboardRow>();

  for (const gp of gamePlayers) {
    const game = gameById.get(gp.game_id);
    if (!game) continue;
    const won = gp.team === "A" ? game.team_a_score > game.team_b_score : game.team_b_score > game.team_a_score;
    const lost = gp.team === "A" ? game.team_a_score < game.team_b_score : game.team_b_score < game.team_a_score;
    const cur = acc.get(gp.user_id) ?? {
      user_id: gp.user_id,
      username: usernameById.get(gp.user_id) ?? "?",
      games: 0, wins: 0, losses: 0,
      points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
    };
    cur.games += 1;
    if (won) cur.wins += 1;
    if (lost) cur.losses += 1;
    cur.points += gp.points;
    cur.rebounds += gp.rebounds;
    cur.assists += gp.assists;
    cur.steals += gp.steals;
    cur.blocks += gp.blocks;
    acc.set(gp.user_id, cur);
  }
  return [...acc.values()].sort((a, b) => b.points - a.points);
}

export function buildTeamRecords(
  members: Member[],
  games: GameRow[],
  gamePlayers: GamePlayerRow[]
): TeamRecord[] {
  const usernameById = new Map(members.map((m) => [m.user_id, m.username]));
  const records = new Map<string, TeamRecord>();

  for (const game of games) {
    const players = gamePlayers.filter((p) => p.game_id === game.id);
    const teamA = players.filter((p) => p.team === "A").map((p) => p.user_id).sort();
    const teamB = players.filter((p) => p.team === "B").map((p) => p.user_id).sort();
    [
      { ids: teamA, scoreFor: game.team_a_score, scoreAgainst: game.team_b_score },
      { ids: teamB, scoreFor: game.team_b_score, scoreAgainst: game.team_a_score },
    ].forEach(({ ids, scoreFor, scoreAgainst }) => {
      if (ids.length === 0) return;
      const key = ids.join(",");
      const cur = records.get(key) ?? {
        members: ids,
        usernames: ids.map((id) => usernameById.get(id) ?? "?"),
        games: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
      };
      cur.games += 1;
      if (scoreFor > scoreAgainst) cur.wins += 1;
      else if (scoreFor < scoreAgainst) cur.losses += 1;
      cur.pointsFor += scoreFor;
      cur.pointsAgainst += scoreAgainst;
      records.set(key, cur);
    });
  }
  return [...records.values()].sort((a, b) => b.wins - a.wins || b.games - a.games);
}
