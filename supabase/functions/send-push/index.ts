// supabase/functions/send-push/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = "BChFv_76vzSxyq4SERSQMZ-CpzlKAWg1Nv64Mm7p1DmffCIsF1Gz-htss51h4IwnOKkafSaoIy7PybUosGyAqDM";
const VAPID_PRIVATE = "WYCB643wpa6_H0bE75q0hjRvkZWU5PcYRbslXsDibAI";

webpush.setVapidDetails("mailto:hoops@app.local", VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { toUserId, title, body, url, tag } = await req.json();
    if (!toUserId || !title) return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error } = await supa.from("push_subscriptions").select("*").eq("user_id", toUserId);
    if (error) throw error;

    const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/app", tag: tag ?? "hoops" });
    const results = await Promise.allSettled(
      (subs ?? []).map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        ).catch(async (err: any) => {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
          throw err;
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, total: results.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
