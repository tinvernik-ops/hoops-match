import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatShell({
  header,
  children,
  onSend,
  placeholder = "Message…",
}: {
  header: ReactNode;
  children: ReactNode;
  onSend: (body: string) => Promise<void>;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto w-full max-w-md px-4 py-3">{header}</div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-4 py-4 space-y-2">{children}</div>
      </div>
      <form onSubmit={submit} className="border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-3 py-3 flex gap-2 items-end">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={2000}
            className="flex-1 h-11 rounded-full bg-secondary border-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || busy}
            className="size-11 rounded-full shrink-0"
            aria-label="Send"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function MessageBubble({
  body,
  mine,
  time,
}: {
  body: string;
  mine: boolean;
  time: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug break-words ${
          mine
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        }`}
      >
        <div className="whitespace-pre-wrap">{body}</div>
        <div className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
