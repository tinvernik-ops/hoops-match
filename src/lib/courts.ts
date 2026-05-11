import { supabase } from "@/integrations/supabase/client";
import { distanceKm, type PlayerWithStats } from "@/lib/players";

export type Court = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  created_by: string;
  created_at: string;
};

export type CourtWithCount = Court & {
  player_count: number;
  players: PlayerWithStats[];
  distance_km: number | null;
};

const COURT_RADIUS_KM = 0.1; // ~100m

export async function fetchCourts(): Promise<Court[]> {
  const { data, error } = await supabase.from("courts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Court[];
}

export function clusterPlayersAtCourts(
  courts: Court[],
  players: PlayerWithStats[],
  me: { lat: number; lng: number } | null
): CourtWithCount[] {
  return courts
    .map((c) => {
      const playersHere = players.filter(
        (p) => p.lat != null && p.lng != null && distanceKm({ lat: c.lat, lng: c.lng }, { lat: p.lat, lng: p.lng }) <= COURT_RADIUS_KM
      );
      const dist = me ? distanceKm(me, { lat: c.lat, lng: c.lng }) : null;
      return { ...c, player_count: playersHere.length, players: playersHere, distance_km: dist };
    })
    .sort((a, b) => {
      if (a.distance_km == null && b.distance_km == null) return 0;
      if (a.distance_km == null) return 1;
      if (b.distance_km == null) return -1;
      return a.distance_km - b.distance_km;
    });
}

export async function createCourt(input: { name: string; lat: number; lng: number; userId: string }) {
  const { error } = await supabase.from("courts").insert({
    name: input.name,
    lat: input.lat,
    lng: input.lng,
    created_by: input.userId,
  });
  if (error) throw error;
}
