import { supabase } from "@/integrations/supabase/client";
import { fromPublicProfiles } from "@/lib/public-profiles";

export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type LeagueMessage = {
  id: string;
  league_id: string;
  user_id: string;
  body: string | null;
  image_url: string | null;
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

const CHAT_BUCKET = "chat-images";
const SIGN_TTL = 60 * 60 * 24 * 7;
const urlCache = new Map<string, { url: string; until: number }>();

export async function getChatImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const c = urlCache.get(path);
  if (c && c.until > Date.now()) return c.url;
  const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, SIGN_TTL);
  if (!data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + SIGN_TTL * 900 });
  return data.signedUrl;
}

export async function uploadChatImage(userId: string, file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8MB");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 4);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: msgs, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, image_url, read_at, created_at")
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
        last_body: m.body && m.body.length ? m.body : (m.image_url ? "📷 Photo" : ""),
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

  const { data: profiles } = await fromPublicProfiles<{ id: string; username: string; avatar_url: string | null }>()
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

export async function sendDirectMessage(
  senderId: string,
  recipientId: string,
  body: string,
  imageUrl?: string | null,
) {
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed && !imageUrl) return;
  const { error } = await supabase.from("direct_messages").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    body: trimmed || null,
    image_url: imageUrl ?? null,
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
    .select("id, league_id, user_id, body, image_url, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  let profMap = new Map<string, { username: string; avatar_url: string | null }>();
  if (ids.length > 0) {
    const { data: profs } = await fromPublicProfiles<{ id: string; username: string; avatar_url: string | null }>()
      .select("id, username, avatar_url")
      .in("id", ids);
    profMap = new Map((profs ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
  }
  return rows.map((m) => {
    const p = profMap.get(m.user_id);
    return {
      id: m.id,
      league_id: m.league_id,
      user_id: m.user_id,
      body: m.body,
      image_url: (m as { image_url: string | null }).image_url ?? null,
      created_at: m.created_at,
      username: p?.username ?? "",
      avatar_url: p?.avatar_url ?? null,
    };
  });
}

export async function sendLeagueMessage(
  leagueId: string,
  userId: string,
  body: string,
  imageUrl?: string | null,
) {
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed && !imageUrl) return;
  const { error } = await supabase
    .from("league_messages")
    .insert({ league_id: leagueId, user_id: userId, body: trimmed || null, image_url: imageUrl ?? null });
  if (error) throw error;
}
