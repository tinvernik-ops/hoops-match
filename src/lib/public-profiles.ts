import { supabase } from "@/integrations/supabase/client";

// Typed wrapper around the `public_profiles` view, which exposes only
// non-sensitive profile columns (id, username, avatar_url, height_cm,
// lat, lng, playstyle, preferred_game_type, created_at, updated_at).
// The view isn't part of the generated Supabase types, so we cast.

export type PublicProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  height_cm: number | null;
  lat: number | null;
  lng: number | null;
  playstyle: string | null;
  preferred_game_type: string | null;
  created_at: string;
  updated_at: string;
};

type Filterable<T> = {
  select: (cols?: string) => Filterable<T>;
  eq: (k: string, v: string) => Filterable<T>;
  in: (k: string, v: string[]) => Filterable<T>;
  neq: (k: string, v: string) => Filterable<T>;
  ilike: (k: string, v: string) => Filterable<T>;
  limit: (n: number) => Filterable<T>;
  maybeSingle: () => Promise<{ data: T | null; error: { message: string } | null }>;
  then: <R>(onfulfilled?: (value: { data: T[] | null; error: { message: string } | null }) => R) => Promise<R>;
};

export function fromPublicProfiles<T = PublicProfile>(): Filterable<T> {
  return (supabase as unknown as { from: (t: string) => Filterable<T> }).from("public_profiles");
}
