import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchLeagueMessages, sendLeagueMessage, uploadChatImage } from "@/lib/messages";
import { UserAvatar } from "@/components/user-avatar";
import { ChatShell } from "@/components/chat-shell";
import { ChatImage } from "@/components/chat-image";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leagues/$id/chat")({
  component: LeagueChat,
});

function LeagueChat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: league } = useQuery({
    queryKey: ["league-name", id],
    queryFn: async () => {
      const { data } = await supabase.from("leagues").select("name").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["league-chat", id],
    queryFn: () => fetchLeagueMessages(id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`lm-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_messages", filter: `league_id=eq.${id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, id, refetch]);

  async function send(body: string) {
    if (!user) return;
    try {
      await sendLeagueMessage(id, user.id, body);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function sendImage(file: File) {
    if (!user) return;
    try {
      const path = await uploadChatImage(user.id, file);
      await sendLeagueMessage(id, user.id, "", path);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <ChatShell
      header={
        <div className="flex items-center gap-3">
          <button onClick={() => nav({ to: "/app/leagues/$id", params: { id } })} className="size-9 grid place-items-center -ml-2 text-muted-foreground">
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <div className="font-semibold truncate text-sm">{league?.name ?? "League"}</div>
            <div className="text-[10px] text-muted-foreground">League chat</div>
          </div>
        </div>
      }
      onSend={send}
      placeholder="Talk to the league…"
    >
      {messages.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-10">Be the first to say something 🏀</p>
      ) : (
        messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <UserAvatar avatarPath={m.avatar_url} fallback={m.username || "?"} className="size-8 self-end" textClassName="text-xs" />
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && <span className="text-[10px] text-muted-foreground px-1 mb-0.5">@{m.username}</span>}
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-snug break-words ${
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
                }`}>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </ChatShell>
  );
}
