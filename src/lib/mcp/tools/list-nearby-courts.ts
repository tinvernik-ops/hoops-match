import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const LOCATION_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
const COURT_RADIUS_KM = 0.1;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_nearby_courts",
  title: "List nearby courts",
  description: "List basketball courts near the signed-in user, ordered by distance, with a count of hoopers currently checked in at each court.",
  inputSchema: {
    radius_km: z.number().positive().max(200).default(25).describe("Search radius in kilometers. Defaults to 25 km."),
    limit: z.number().int().positive().max(50).default(20).describe("Maximum number of courts to return. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ radius_km, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const [{ data: me }, { data: courts, error: cErr }, { data: players, error: pErr }] = await Promise.all([
      supabase.from("profiles").select("lat, lng").eq("id", userId).maybeSingle(),
      supabase.from("courts").select("id, name, lat, lng, created_at"),
      supabase.from("public_profiles").select("id, lat, lng, location_updated_at"),
    ]);
    if (cErr) return { content: [{ type: "text", text: cErr.message }], isError: true };
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };

    const now = Date.now();
    const activePlayers = (players ?? []).filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        p.location_updated_at &&
        now - new Date(p.location_updated_at).getTime() <= LOCATION_FRESH_MS
    );

    const result = (courts ?? [])
      .map((c) => {
        const playersHere = activePlayers.filter(
          (p) => distanceKm({ lat: c.lat, lng: c.lng }, { lat: p.lat!, lng: p.lng! }) <= COURT_RADIUS_KM
        );
        const dist = me?.lat && me?.lng ? distanceKm({ lat: me.lat, lng: me.lng }, { lat: c.lat, lng: c.lng }) : null;
        return {
          id: c.id,
          name: c.name,
          lat: c.lat,
          lng: c.lng,
          distance_km: dist == null ? null : Number(dist.toFixed(2)),
          hoopers_here: playersHere.length,
        };
      })
      .filter((c) => c.distance_km == null || c.distance_km <= radius_km)
      .sort((a, b) => {
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      })
      .slice(0, limit);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { courts: result },
    };
  },
});
