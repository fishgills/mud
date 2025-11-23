import { ItemType, PlayerSlot } from '@mud/database';
import type { ItemQualityType } from '@mud/database';

export type ItemSpawnRarity = ItemQualityType;

export interface ItemTemplateSeed {
  name: string;
  type: ItemType;
  description: string;
  value: number;
  damageRoll?: string;
  defense?: number;
  slot?: PlayerSlot;
  rarity: ItemSpawnRarity;
  dropWeight: number;
  rank?: number; // 1..MAX_ITEM_RANK
}

export interface WeightedItemTemplate {
  template: ItemTemplateSeed;
  weight: number;
}

export interface WeightedQuality {
  quality: ItemQualityType;
  weight: number;
}

export const MAX_ITEM_RANK = 10;
export const MAX_PLAYER_SCALE = 20;
