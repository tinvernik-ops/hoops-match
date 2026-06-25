import { supabase } from "@/integrations/supabase/client";

export type GameVerification = {
  id: string;
  game_id: string;
  user_id: string;
  score_status: "pending" | "approved" | "disputed";
  stats_status: "pending" | "approved" | "disputed" | "skipped";
  dispute_note: string | null;
  responded_at: string | null;
};

export type PendingVerification = GameVerification & {
  game: {
    id: string;
    league_id: string;
    created_by: string;
    team_a_score: number;
    team_b_score: number;
    game_type: string;
    played_at: string;
    location: string | null;
  };
};

export async function fetchPendingVerifications(userId: string): Promise<PendingVerification[]> {
  const { data, error } = await supabase
    .from("game_verifications")
    .select(
      "id, game_id, user_id, score_status, stats_status, dispute_note, responded_at, game:games!inner(id, league_id, created_by, team_a_score, team_b_score, game_type, played_at, location)"
    )
    .eq("user_id", userId)
    .eq("score_status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PendingVerification[];
}

export async function fetchGameVerification(gameId: string, userId: string) {
  const { data, error } = await supabase
    .from("game_verifications")
    .select("*")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as GameVerification | null;
}

export async function fetchAllGameVerifications(gameId: string) {
  const { data, error } = await supabase
    .from("game_verifications")
    .select("*")
    .eq("game_id", gameId);
  if (error) throw error;
  return (data ?? []) as GameVerification[];
}
