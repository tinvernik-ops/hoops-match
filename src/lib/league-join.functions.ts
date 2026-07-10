import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Looks up a league by its private join_code without exposing the leagues
// table to non-members, then enrolls the caller as a member. When a new
// member is added, posts a system message to the league chat and fires a
// push notification to the existing members.
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

    // Was the caller already a member? Use that to detect a fresh join.
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
    }

    if (!alreadyMember) {
      // Best-effort notification/activity; never block the join on failure.
      try {
        await notifyLeagueOfNewMember(supabaseAdmin, {
          leagueId: league.id,
          leagueName: league.name,
          newMemberId: context.userId,
        });
      } catch (e) {
        console.warn("[league-join] notify failed", e);
      }
    }

    return { leagueId: league.id, joined: !alreadyMember };
  });

type AdminClient = Awaited<
  ReturnType<typeof import("@/integrations/supabase/client.server")["supabaseAdmin"]["from"]>
> extends never
  ? never
  : Awaited<ReturnType<typeof import("./_league-join-noop")>>;

// Keep the helper signature loose — it's only ever called with supabaseAdmin.
async function notifyLeagueOfNewMember(
  supa: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  args: { leagueId: string; leagueName: string; newMemberId: string }
) {
  const { leagueId, leagueName, newMemberId } = args;

  const { data: prof } = await supa
    .from("profiles")
    .select("username")
    .eq("id", newMemberId)
    .maybeSingle();
  const username = prof?.username ?? "A new hooper";

  // 1) In-app activity entry: system message in the league chat, authored
  //    by the joining user (satisfies the check-constraint on body).
  await supa.from("league_messages").insert({
    league_id: leagueId,
    user_id: newMemberId,
    body: `🏀 @${username} joined the league`,
  });

  // 2) Push notification to existing league members (everyone except the
  //    person who just joined).
  const { data: members } = await supa
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  const recipients = (members ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== newMemberId);
  if (recipients.length === 0) return;

  const title = leagueName;
  const body = `@${username} joined the league`;
  const url = `/app/leagues/${leagueId}`;

  await Promise.allSettled(
    recipients.map((toUserId) =>
      supa.functions.invoke("send-push", {
        body: { toUserId, title, body, url, tag: `league-${leagueId}-join` },
      })
    )
  );
}

// Unused type helper stub to keep TS happy without pulling in server module at type-check time
export type _Unused = AdminClient;
