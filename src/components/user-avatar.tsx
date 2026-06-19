import { useEffect, useState } from "react";
import { getSignedAvatarUrl } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Props = {
  avatarPath?: string | null;
  fallback: string;
  className?: string;
  textClassName?: string;
};

export function UserAvatar({ avatarPath, fallback, className, textClassName }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!avatarPath) {
      setUrl(null);
      return;
    }
    getSignedAvatarUrl(avatarPath).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [avatarPath]);

  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-gradient-to-br from-primary to-rim text-primary-foreground overflow-hidden shrink-0",
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn("text-display font-bold", textClassName)}>{fallback.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}
