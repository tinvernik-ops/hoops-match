import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_leagues",
  title: "List my leagues",
  description: "List all Hoops leagues the signed-in user is a member of, with league id, name, and join code.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: memberships, error: mErr } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", ctx.getUserId()!);
    if (mErr) return { content: [{ type: "text", text: mErr.message }], isError: true };
    const ids = (memberships ?? []).map((m) => m.league_id);
    if (ids.length === 0) {
      return { content: [{ type: "text", text: "You aren't in any leagues yet." }], structuredContent: { leagues: [] } };
    }
    const { data, error } = await supabase
      .from("leagues")
      .select("id, name, join_code, owner_id, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { leagues: data ?? [] },
    };
  },
});
