// NBA 2K-style player archetypes / playstyles
export const PLAYSTYLES = [
  "Slasher",
  "Sharpshooter",
  "Playmaker",
  "Lockdown Defender",
  "Glass Cleaner",
  "Stretch Big",
  "Shot Creator",
  "Two-Way Slasher",
  "Two-Way Sharpshooter",
  "Pure Sharpshooter",
  "Slashing Playmaker",
  "Inside-Out Scorer",
  "Post Scorer",
  "Rim Protector",
  "3-and-D",
  "Paint Beast",
  "Offensive Threat",
  "All-Around",
] as const;

export type Playstyle = (typeof PLAYSTYLES)[number];
