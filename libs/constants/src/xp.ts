export const WORLD_CHUNK_SIZE = 50;

export const getXpThresholdForLevel = (level: number): number =>
  Math.floor((100 * (level * (level + 1))) / 2);

export const getXpToNextLevel = (level: number, currentXp: number): number =>
  Math.max(0, getXpThresholdForLevel(level) - currentXp);
