import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

const memCache = new Map<string, { url: string; until: number }>();

function pathForUser(userId: string) {
  return `${userId}/avatar`;
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 4);
  const path = `${pathForUser(userId)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (upErr) throw upErr;

  // Save the storage path on the profile (we sign URLs on read).
  const { error: pErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
  if (pErr) throw pErr;

  memCache.delete(userId);
  return path;
}

export async function getSignedAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const cached = memCache.get(path);
  if (cached && cached.until > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error || !data?.signedUrl) return null;
  memCache.set(path, { url: data.signedUrl, until: Date.now() + SIGNED_TTL * 900 });
  return data.signedUrl;
}
