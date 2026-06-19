import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchThread, markThreadRead, sendDirectMessage } from "@/lib/messages";
import { sendPushTo } from "@/lib/push";
import { UserAvatar } from "@/components/user-avatar";
import { ChatShell, MessageBubble } from "@/components/chat-shell";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/messages/$userId")({
  component: DMThread,
});

function DMThread() {
  const { userId: otherId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: other } = useQuery({
    queryKey: ["profile-mini", otherId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      return data as { id: string; username: string; avatar_url: string | null } | null;
    },
  });

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["dm-thread", user?.id, otherId],
    queryFn: () => fetchThread(user!.id, otherId),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    markThreadRead(user.id, otherId).catch(() => {});
    const ch = supabase
      .channel(`dm-${user.id}-${otherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${otherId}` },
        () => {
          refetch();
          markThreadRead(user.id, otherId).catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, otherId, refetch]);

  async function send(body: string) {
    if (!user) return;
    try {
      await sendDirectMessage(user.id, otherId, body);
      sendPushTo({
        toUserId: otherId,
        title: `💬 @${user.email?.split("@")[0] ?? "someone"}`,
        body: body.slice(0, 120),
        url: `/app/messages/${user.id}`,
        tag: `dm-${user.id}`,
      });
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <ChatShell
      header={
        <div className="flex items-center gap-3">
          <button onClick={() => nav({ to: "/app/messages" })} className="size-9 grid place-items-center -ml-2 text-muted-foreground">
            <ArrowLeft className="size-5" />
          </button>
          <UserAvatar avatarPath={other?.avatar_url} fallback={other?.username || "?"} className="size-9" textClassName="text-sm" />
          <div className="min-w-0">
            <div className="font-semibold truncate text-sm">@{other?.username ?? "…"}</div>
            <div className="text-[10px] text-muted-foreground">Direct message</div>
          </div>
        </div>
      }
      onSend={send}
      placeholder="Send a message…"
    >
      {messages.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-10">Say what's up 🏀</p>
      ) : (
        messages.map((m) => (
          <MessageBubble key={m.id} body={m.body} mine={m.sender_id === user?.id} time={m.created_at} />
        ))
      )}
    </ChatShell>
  );
}
