import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Looks up a league by its private join_code without exposing the leagues
// table to non-members, then enrolls the caller as a member. On a fresh
// join, posts a system message in the league chat and fires a push
// notification to the existing members.
export const joinLeagueByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(4).max(32) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();

    const { data: league, error: lookupErr } = await supabaseAdmin
      .from("leagues")
      .select("id, name")
      .eq("join_code", code)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!league) throw new Error("League not found");

    const { data: existing } = await supabaseAdmin
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const alreadyMember = !!existing;

    if (!alreadyMember) {
      const { error: insertErr } = await supabaseAdmin
        .from("league_members")
        .insert({ league_id: league.id, user_id: context.userId });
      if (insertErr && !/duplicate/i.test(insertErr.message)) {
        throw new Error(insertErr.message);
      }

      // Best-effort: don't block the join if notification/activity fails.
      try {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("username")
          .eq("id", context.userId)
          .maybeSingle();
        const username = prof?.username ?? "A new hooper";

        // In-app activity entry: system message in league chat.
        await supabaseAdmin.from("league_messages").insert({
          league_id: league.id,
          user_id: context.userId,
          body: `🏀 @${username} joined the league`,
        });

        // Push notification to existing members (excluding the joiner).
        const { data: members } = await supabaseAdmin
          .from("league_members")
          .select("user_id")
          .eq("league_id", league.id);
        const recipients = (members ?? [])
          .map((m) => m.user_id)
          .filter((id) => id !== context.userId);

        if (recipients.length > 0) {
          await Promise.allSettled(
            recipients.map((toUserId) =>
              supabaseAdmin.functions.invoke("send-push", {
                body: {
                  toUserId,
                  title: league.name,
                  body: `@${username} joined the league`,
                  url: `/app/leagues/${league.id}`,
                  tag: `league-${league.id}-join`,
                },
              })
            )
          );
        }
      } catch (e) {
        console.warn("[league-join] notify failed", e);
      }
    }

    return { leagueId: league.id, joined: !alreadyMember };
  });
