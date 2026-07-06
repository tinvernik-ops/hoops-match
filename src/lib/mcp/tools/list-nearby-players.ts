import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const LOCATION_FRESH_MS = 3 * 24 * 60 * 60 * 1000;

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
  name: "list_nearby_players",
  title: "List nearby hoopers",
  description: "List other Hoops players with fresh locations (checked in within the last 3 days), sorted by distance from the signed-in user.",
  inputSchema: {
    radius_km: z.number().positive().max(200).default(25).describe("Search radius in kilometers. Defaults to 25 km."),
    limit: z.number().int().positive().max(50).default(20).describe("Maximum number of players to return. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ radius_km, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("lat, lng, location_updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) return { content: [{ type: "text", text: meErr.message }], isError: true };
    if (!me?.lat || !me?.lng) {
      return {
        content: [{ type: "text", text: "Your location isn't set yet — check in on the map first." }],
        structuredContent: { players: [] },
      };
    }

    const { data, error } = await supabase
      .from("public_profiles")
      .select("id, username, height_cm, lat, lng, avatar_url, location_updated_at")
      .neq("id", userId);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const now = Date.now();
    const nearby = (data ?? [])
      .filter((p) => p.lat != null && p.lng != null && p.location_updated_at)
      .filter((p) => now - new Date(p.location_updated_at!).getTime() <= LOCATION_FRESH_MS)
      .map((p) => ({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        distance_km: Number(distanceKm({ lat: me.lat!, lng: me.lng! }, { lat: p.lat!, lng: p.lng! }).toFixed(2)),
        last_seen: p.location_updated_at,
      }))
      .filter((p) => p.distance_km <= radius_km)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return {
      content: [{ type: "text", text: JSON.stringify(nearby, null, 2) }],
      structuredContent: { players: nearby },
    };
  },
});
