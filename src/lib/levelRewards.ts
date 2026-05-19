// lib/levelRewards.ts
// Level-based reward system: frames, bonus points, and moderator access

import { db } from "@/db";
import { users, pointsLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// ─── Level formula ────────────────────────────────────────────────────────────
// Each level requires 50 V-Points (level 1 starts at 0 pts)
// Level = floor(points / 50) + 1
// e.g. 0 pts → L1, 50 pts → L2, 200 pts → L5, 700 pts → L15, 1250 pts → L26...
export const getLevel = (points: number): number => Math.floor(points / 50) + 1;

// Points needed to reach a given level
export const getLevelThreshold = (level: number): number => (level - 1) * 50;

// ─── Reward definitions ───────────────────────────────────────────────────────
export const LEVEL_REWARDS = [
  { level: 5,   type: "points"     as const, value: 250,         label: "+250 V-Point Bonus Level 5!"    },
  { level: 15,  type: "frame"      as const, value: "wood",      label: "Frame Kayu (Level 15)"           },
  { level: 25,  type: "frame"      as const, value: "bronze",    label: "Frame Perunggu (Level 25)"       },
  { level: 50,  type: "frame"      as const, value: "silver",    label: "Frame Silver (Level 50)"         },
  { level: 60,  type: "frame"      as const, value: "gold",      label: "Frame Emas (Level 60)"           },
  { level: 100, type: "role"       as const, value: "moderator", label: "Akses Moderator (Level 100)"     },
];

export type GrantedReward = {
  level: number;
  label: string;
  type: "points" | "frame" | "role";
  value: number | string;
};

// ─── Core function ────────────────────────────────────────────────────────────
/**
 * After awarding points to a user, call this to check if any level thresholds
 * were crossed and grant the corresponding rewards (bonus points, frames, role).
 *
 * @param userId   DB UUID of the user
 * @param oldPoints Points before the current award
 * @param newPoints Points after the current award (before any bonus from level rewards)
 * @returns List of newly granted rewards
 */
export async function checkAndGrantLevelRewards(
  userId: string,
  oldPoints: number,
  newPoints: number,
): Promise<GrantedReward[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { claimedLevelRewards: true },
  });

  const claimed = (user?.claimedLevelRewards as number[] | null) ?? [];
  const oldLevel = getLevel(oldPoints);
  const currentLevel = getLevel(newPoints);

  const newClaimed = [...claimed];
  let bonusPoints = 0;
  let newFrame: string | null = null;
  let grantModerator = false;
  const granted: GrantedReward[] = [];

  // Pass 1: rewards for levels crossed in this award
  for (const reward of LEVEL_REWARDS) {
    if (
      reward.level > oldLevel &&
      reward.level <= currentLevel &&
      !claimed.includes(reward.level)
    ) {
      newClaimed.push(reward.level);
      if (reward.type === "points") {
        bonusPoints += reward.value as number;
      } else if (reward.type === "frame") {
        newFrame = reward.value as string;
      } else if (reward.type === "role") {
        grantModerator = true;
      }
      granted.push({ level: reward.level, label: reward.label, type: reward.type, value: reward.value });
    }
  }

  // Pass 2: if bonus points push into more levels, check for frame/role only
  // (no recursive point bonuses to avoid infinite cascades)
  if (bonusPoints > 0) {
    const afterBonusLevel = getLevel(newPoints + bonusPoints);
    for (const reward of LEVEL_REWARDS) {
      if (
        reward.level > currentLevel &&
        reward.level <= afterBonusLevel &&
        !newClaimed.includes(reward.level) &&
        reward.type !== "points"
      ) {
        newClaimed.push(reward.level);
        if (reward.type === "frame") newFrame = reward.value as string;
        else if (reward.type === "role") grantModerator = true;
        granted.push({ level: reward.level, label: reward.label, type: reward.type, value: reward.value });
      }
    }
  }

  if (granted.length === 0) return [];

  // Commit all non-points changes (claimed list, frame, role)
  await db.update(users)
    .set({
      claimedLevelRewards: newClaimed,
      ...(newFrame ? { levelFrame: newFrame } : {}),
      ...(grantModerator ? { role: "moderator" as const } : {}),
    })
    .where(eq(users.id, userId));

  // Commit bonus points separately (uses sql expression)
  if (bonusPoints > 0) {
    await db.update(users)
      .set({ points: sql`${users.points} + ${bonusPoints}` })
      .where(eq(users.id, userId));

    await db.insert(pointsLog).values({
      userId,
      action: "level_reward_points",
      delta: bonusPoints,
      refId: null,
    });
  }

  return granted;
}
