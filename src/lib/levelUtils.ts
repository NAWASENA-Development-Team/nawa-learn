// lib/levelUtils.ts
// Pure math helpers for level calculations — NO server imports, safe for client components.
//
// XP to go from level N to level N+1 = N * 50 (linear scaling)
// Total XP to reach level N           = 25 * N * (N-1)
//   L1=0 XP, L2=50, L3=150, L4=300, L5=500, L10=2250, L15=5250 ...

export const getLevel = (points: number): number =>
  Math.floor((1 + Math.sqrt(1 + (4 * points) / 25)) / 2);

export const getLevelThreshold = (level: number): number => 25 * level * (level - 1);

export const getPointsToNextLevel = (points: number): { current: number; needed: number } => {
  const level = getLevel(points);
  const threshold = getLevelThreshold(level);
  const nextThreshold = getLevelThreshold(level + 1);
  return {
    current: points - threshold,
    needed: nextThreshold - threshold, // = level * 50
  };
};
