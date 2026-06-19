import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchConversations } from "@/lib/messages";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { ArrowLeft, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/app/messages/")({
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: convos = [], refetch } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => fetchConversations(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("dm-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages", filter: `sender_id=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refetch]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4">
      <button onClick={() => nav({ to: "/app" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="text-display text-3xl font-bold mb-5">Messages</h1>

      {convos.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center">
          <MessageSquare className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No conversations yet. Open any hooper's profile and tap Message to start one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {convos.map((c) => (
            <Link
              key={c.other_id}
              to="/app/messages/$userId"
              params={{ userId: c.other_id }}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 border border-border/60 active:scale-[0.99] transition"
            >
              <UserAvatar avatarPath={c.avatar_url} fallback={c.username || "?"} className="size-12" textClassName="text-lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold truncate">@{c.username}</div>
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(c.last_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div className={`text-xs truncate ${c.unread > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {c.last_from_me && "You: "}
                  {c.last_body}
                </div>
              </div>
              {c.unread > 0 && (
                <span className="grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
