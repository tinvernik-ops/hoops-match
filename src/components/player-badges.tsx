type Tier = "bronze" | "silver" | "gold" | "hof";

const TIER_STYLES: Record<Tier, string> = {
  bronze: "bg-[oklch(0.55_0.13_55)] text-white",
  silver: "bg-[oklch(0.78_0.02_240)] text-black",
  gold: "bg-[oklch(0.82_0.16_85)] text-black",
  hof: "bg-gradient-to-br from-[oklch(0.55_0.25_300)] to-[oklch(0.45_0.22_260)] text-white ring-1 ring-white/30",
};

const TIER_LABEL: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  hof: "HOF",
};

function tier(value: number | null, minSample: boolean): Tier | null {
  if (value == null || !minSample) return null;
  if (value >= 92) return "hof";
  if (value >= 85) return "gold";
  if (value >= 75) return "silver";
  if (value >= 65) return "bronze";
  return null;
}

export type BadgeInputs = {
  offense: number | null;
  defense: number | null;
  ratingsCount: number;
  shotRating: number | null;
  threeRating: number | null;
  midRating: number | null;
  threeAttempts: number;
  midAttempts: number;
  totalShotAttempts: number;
};

export function PlayerBadges(props: BadgeInputs) {
  const enoughRatings = props.ratingsCount >= 3;
  const badges: Array<{ name: string; tier: Tier }> = [];
  const add = (name: string, t: Tier | null) => {
    if (t) badges.push({ name, tier: t });
  };
  add("Scorer", tier(props.offense, enoughRatings));
  add("Lockdown", tier(props.defense, enoughRatings));
  add("Sharpshooter", tier(props.shotRating, props.totalShotAttempts >= 25));
  add("Deadeye", tier(props.threeRating, props.threeAttempts >= 15));
  add("Mid-Range Maestro", tier(props.midRating, props.midAttempts >= 15));

  if (badges.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-4 text-center">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Badges</div>
        <div className="text-xs text-muted-foreground mt-1">
          Play and log shots — badges unlock from teammate ratings and your drill percentages.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-1 mb-2">Badges</div>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <span
            key={b.name}
            className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${TIER_STYLES[b.tier]}`}
            title={`${b.name} · ${TIER_LABEL[b.tier]}`}
          >
            {TIER_LABEL[b.tier]} · {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}
