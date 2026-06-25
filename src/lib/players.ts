import { supabase } from "@/integrations/supabase/client";
import { fromPublicProfiles } from "@/lib/public-profiles";

export type PlayerRow = {
  id: string;
  username: string;
  height_cm: number | null;
  lat: number | null;
  lng: number | null;
  avatar_url: string | null;
};

export type PlayerWithStats = PlayerRow & {
  offense_avg: number | null;
  defense_avg: number | null;
  rating_count: number;
  distance_km: number | null;
};

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function fetchPlayersWithStats(currentUserId: string, me: { lat: number; lng: number } | null) {
  const [profilesRes, ratingsRes] = await Promise.all([
    fromPublicProfiles<PlayerRow>()
      .select("id,username,height_cm,lat,lng,avatar_url")
      .neq("id", currentUserId),
    supabase.from("ratings").select("ratee_id,offense,defense"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (ratingsRes.error) throw ratingsRes.error;
  const profiles = profilesRes.data;
  const ratings = ratingsRes.data;

  const stats = new Map<string, { o: number; d: number; n: number }>();
  for (const r of ratings ?? []) {
    const cur = stats.get(r.ratee_id) ?? { o: 0, d: 0, n: 0 };
    cur.o += r.offense;
    cur.d += r.defense;
    cur.n += 1;
    stats.set(r.ratee_id, cur);
  }

  const enriched: PlayerWithStats[] = (profiles ?? []).map((p) => {
    const s = stats.get(p.id);
    return {
      ...p,
      offense_avg: s ? Math.round(s.o / s.n) : null,
      defense_avg: s ? Math.round(s.d / s.n) : null,
      rating_count: s?.n ?? 0,
      distance_km: me && p.lat != null && p.lng != null ? distanceKm(me, { lat: p.lat, lng: p.lng }) : null,
    };
  });

  enriched.sort((a, b) => {
    if (a.distance_km == null && b.distance_km == null) return 0;
    if (a.distance_km == null) return 1;
    if (b.distance_km == null) return -1;
    return a.distance_km - b.distance_km;
  });
  return enriched;
}
