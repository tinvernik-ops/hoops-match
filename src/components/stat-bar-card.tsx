type Props = {
  initial: string;
  name: string;
  defense: number | null;
  offense: number | null;
};

/**
 * Player stat card matching the design: avatar bubble on the left, name on top,
 * red defense bar with value on the right, green offense bar with value on the right.
 */
export function StatBarCard({ initial, name, defense, offense }: Props) {
  return (
    <div className="rounded-2xl border-2 border-foreground/80 bg-card p-3 sm:p-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="grid place-items-center size-16 sm:size-20 rounded-full border-2 border-foreground/80 shrink-0">
          <div className="grid place-items-center size-10 sm:size-12 rounded-full border-2 border-foreground/70 text-display text-lg sm:text-xl font-bold">
            {initial}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-display text-base sm:text-lg font-bold tracking-wide truncate text-center mb-1">
            @{name}
          </div>
          <StatBar color="red" value={defense} />
          <div className="h-2" />
          <StatBar color="green" value={offense} />
        </div>
      </div>
    </div>
  );
}

function StatBar({ color, value }: { color: "red" | "green"; value: number | null }) {
  const v = value ?? 0;
  const pct = Math.max(4, Math.min(100, v));
  const bg =
    color === "red"
      ? "bg-[oklch(0.6_0.24_25)]"
      : "bg-[oklch(0.78_0.22_135)]";
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 h-3 sm:h-3.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${bg} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-display text-lg sm:text-xl font-bold w-8 text-right">
        {value ?? "—"}
      </span>
    </div>
  );
}
