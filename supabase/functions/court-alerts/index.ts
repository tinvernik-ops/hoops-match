// supabase/functions/court-alerts/index.ts
// Scans for courts with >= threshold hoopers nearby, sends one push per nearby user
// (subject to that user's own threshold + radius), and dedupes via court_alert_state.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const VAPID_PUBLIC = "BChFv_76vzSxyq4SERSQMZ-CpzlKAWg1Nv64Mm7p1DmffCIsF1Gz-htss51h4IwnOKkafSaoIy7PybUosGyAqDM";
const VAPID_PRIVATE = "WYCB643wpa6_H0bE75q0hjRvkZWU5PcYRbslXsDibAI";
webpush.setVapidDetails("mailto:hoops@app.local", VAPID_PUBLIC, VAPID_PRIVATE);

const COURT_RADIUS_KM = 0.1; // ~100m: a player is "at" a court
const COOLDOWN_MIN = 60;

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

Deno.serve(async () => {
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: courts }, { data: profiles }, { data: state }] = await Promise.all([
      supa.from("courts").select("id, name, lat, lng"),
      supa.from("profiles").select("id, username, lat, lng, court_alert_threshold, court_alert_radius_km, location_updated_at"),
      supa.from("court_alert_state").select("*"),
    ]);

    const stateMap = new Map<string, { last_player_count: number; last_alert_at: string | null }>();
    for (const s of state ?? []) stateMap.set(s.court_id, s);

    const now = Date.now();
    const stalePlayerCutoff = now - 60 * 60 * 1000; // ignore profiles whose location is >1h old
    const activePlayers = (profiles ?? []).filter(
      (p: any) => p.lat != null && p.lng != null && (!p.location_updated_at || new Date(p.location_updated_at).getTime() > stalePlayerCutoff),
    );

    let totalSent = 0;

    for (const c of courts ?? []) {
      const here = activePlayers.filter((p: any) => distKm(c, { lat: p.lat, lng: p.lng }) <= COURT_RADIUS_KM);
      const playerCount = here.length;
      const prev = stateMap.get(c.id);
      const sinceLast = prev?.last_alert_at ? (now - new Date(prev.last_alert_at).getTime()) / 60000 : Infinity;

      // Persist current count for everyone to see; only alert when it crossed up.
      await supa.from("court_alert_state").upsert({
        court_id: c.id,
        last_player_count: playerCount,
        last_alert_at: prev?.last_alert_at ?? null,
      });

      if (playerCount < 2) continue;
      if ((prev?.last_player_count ?? 0) >= playerCount) continue; // no increase
      if (sinceLast < COOLDOWN_MIN) continue;

      // Find users whose own threshold is met and who are within their own alert radius.
      const targets = (profiles ?? []).filter((u: any) => {
        if (u.lat == null || u.lng == null) return false;
        const threshold = u.court_alert_threshold ?? 3;
        const radius = Number(u.court_alert_radius_km ?? 10);
        if (playerCount < threshold) return false;
        if (distKm({ lat: u.lat, lng: u.lng }, c) > radius) return false;
        // Don't notify someone who is already at the court.
        if (here.some((p: any) => p.id === u.id)) return false;
        return true;
      });

      if (targets.length === 0) {
        // still update the alert timestamp so we don't keep recomputing
        continue;
      }

      const { data: subs } = await supa
        .from("push_subscriptions")
        .select("*")
        .in("user_id", targets.map((t: any) => t.id));

      const payload = JSON.stringify({
        title: `🏀 ${playerCount} hoopers at ${c.name}`,
        body: "Court's heating up near you — run it.",
        url: "/app",
        tag: `court-${c.id}`,
      });

      const results = await Promise.allSettled(
        (subs ?? []).map((s: any) =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          ).catch(async (err: any) => {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            }
            throw err;
          }),
        ),
      );
      const sent = results.filter((r) => r.status === "fulfilled").length;
      totalSent += sent;

      await supa.from("court_alert_state").upsert({
        court_id: c.id,
        last_player_count: playerCount,
        last_alert_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
