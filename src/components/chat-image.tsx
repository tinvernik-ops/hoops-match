import { useEffect, useState } from "react";
import { getChatImageUrl } from "@/lib/messages";

export function ChatImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getChatImageUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) {
    return <div className={`bg-muted/30 animate-pulse rounded-lg h-40 w-40 ${className ?? ""}`} />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Shared" className={className} loading="lazy" />
    </a>
  );
}
