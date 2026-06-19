import { supabase } from "@/integrations/supabase/client";

export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type LeagueMessage = {
  id: string;
  league_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type ConversationSummary = {
  other_id: string;
  username: string;
  avatar_url: string | null;
  last_body: string;
  last_at: string;
  unread: number;
  last_from_me: boolean;
};

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: msgs, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const byOther = new Map<string, ConversationSummary>();
  const unreadByOther = new Map<string, number>();
  for (const m of msgs ?? []) {
    const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!byOther.has(other)) {
      byOther.set(other, {
        other_id: other,
        username: "",
        avatar_url: null,
        last_body: m.body,
        last_at: m.created_at,
        unread: 0,
        last_from_me: m.sender_id === userId,
      });
    }
    if (m.recipient_id === userId && !m.read_at) {
      unreadByOther.set(other, (unreadByOther.get(other) ?? 0) + 1);
    }
  }

  const ids = [...byOther.keys()];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);

  for (const p of profiles ?? []) {
    const c = byOther.get(p.id);
    if (c) {
      c.username = p.username ?? "";
      c.avatar_url = (p as { avatar_url: string | null }).avatar_url ?? null;
      c.unread = unreadByOther.get(p.id) ?? 0;
    }
  }
  return [...byOther.values()];
}

export async function fetchThread(meId: string, otherId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`,
    )
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

export async function sendDirectMessage(senderId: string, recipientId: string, body: string) {
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) return;
  const { error } = await supabase.from("direct_messages").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    body: trimmed,
  });
  if (error) throw error;
}

export async function markThreadRead(meId: string, otherId: string) {
  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", meId)
    .eq("sender_id", otherId)
    .is("read_at", null);
}

export async function fetchLeagueMessages(leagueId: string): Promise<(LeagueMessage & { username: string; avatar_url: string | null })[]> {
  const { data, error } = await supabase
    .from("league_messages")
    .select("id, league_id, user_id, body, created_at, profiles!inner(username, avatar_url)")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((m) => {
    const prof = (m as unknown as { profiles: { username: string; avatar_url: string | null } }).profiles;
    return {
      id: m.id,
      league_id: m.league_id,
      user_id: m.user_id,
      body: m.body,
      created_at: m.created_at,
      username: prof?.username ?? "",
      avatar_url: prof?.avatar_url ?? null,
    };
  });
}

export async function sendLeagueMessage(leagueId: string, userId: string, body: string) {
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) return;
  const { error } = await supabase
    .from("league_messages")
    .insert({ league_id: leagueId, user_id: userId, body: trimmed });
  if (error) throw error;
}
