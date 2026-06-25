import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Looks up a league by its private join_code without exposing the leagues
// table to non-members, then enrolls the caller as a member.
export const joinLeagueByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(4).max(32) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();

    const { data: league, error: lookupErr } = await supabaseAdmin
      .from("leagues")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!league) throw new Error("League not found");

    const { error: insertErr } = await supabaseAdmin
      .from("league_members")
      .insert({ league_id: league.id, user_id: context.userId })
      .select()
      .maybeSingle();
    // Duplicate membership is fine; ignore unique-violation.
    if (insertErr && !/duplicate/i.test(insertErr.message)) {
      throw new Error(insertErr.message);
    }
    return { leagueId: league.id };
  });
