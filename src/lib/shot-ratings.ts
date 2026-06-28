export const THREE_ZONES = new Set([
  "three_corner_l",
  "three_corner_r",
  "three_wing_l",
  "three_wing_r",
  "three_top",
]);

export const MID_ZONES = new Set([
  "ft",
  "mid_l",
  "mid_r",
  "elbow_l",
  "elbow_r",
]);

export function ratingFromPct(makes: number, attempts: number): number | null {
  if (attempts <= 0) return null;
  return Math.round(35 + (makes / attempts) * 64);
}

export function splitDrillRatings(drills: Array<{ zone: string; makes: number; attempts: number }>) {
  let totalM = 0, totalA = 0, threeM = 0, threeA = 0, midM = 0, midA = 0;
  for (const d of drills) {
    totalM += d.makes ?? 0;
    totalA += d.attempts ?? 0;
    if (THREE_ZONES.has(d.zone)) {
      threeM += d.makes ?? 0;
      threeA += d.attempts ?? 0;
    } else if (MID_ZONES.has(d.zone)) {
      midM += d.makes ?? 0;
      midA += d.attempts ?? 0;
    }
  }
  return {
    overall: ratingFromPct(totalM, totalA),
    three: ratingFromPct(threeM, threeA),
    mid: ratingFromPct(midM, midA),
    totalAttempts: totalA,
    threeAttempts: threeA,
    midAttempts: midA,
  };
}
