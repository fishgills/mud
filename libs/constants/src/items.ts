import type { ItemQualityType } from '@mud/database';
import { ITEM_QUALITY_ORDER, ITEM_QUALITY_PRIORITY } from './quality';
import {
  ItemTemplateSeed,
  WeightedItemTemplate,
  WeightedQuality,
  MAX_ITEM_RANK,
  MAX_PLAYER_SCALE,
} from './item-types';
import { ITEM_TEMPLATES, ITEM_RARITY_LOOKUP } from './templates';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function computeTemplateWeights(level: number): WeightedItemTemplate[] {
  const clampedLevel = Math.max(1, Math.min(level, MAX_PLAYER_SCALE));
  const levelBias = clamp((clampedLevel - 1) * 0.02, 0, 0.6);
  const expected = expectedRankForLevel(clampedLevel);
  return ITEM_TEMPLATES.map((template) => {
    const rarityRank = ITEM_QUALITY_PRIORITY[template.rarity] ?? 0;
    const r = template.rank ?? 1;
    const rankDistance = Math.abs(r - expected);
    const rankPenalty = 1 + rankDistance * 0.9;
    const levelBoost = 1 + levelBias * (r / MAX_ITEM_RANK);
    const rarityPenalty = 1 + rarityRank * 0.8;
    let weight = Math.max(
      0.05,
      (template.dropWeight / (rarityPenalty * rankPenalty)) * levelBoost,
    );
    if (expected >= 7 && r <= expected - 3) {
      weight *= 0.3;
    }
    if (expected >= 9 && r <= expected - 4) {
      weight *= 0.15;
    }
    if (expected >= 8 && r >= expected - 1) {
      weight *= 1.15;
    }
    return { template, weight };
  });
}

export function pickTemplateForLevel(
  level: number,
  rng: () => number = Math.random,
): ItemTemplateSeed {
  const weighted = computeTemplateWeights(level);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (roll <= cumulative) {
      return entry.template;
    }
  }
  return weighted[weighted.length - 1]?.template ?? ITEM_TEMPLATES[0];
}

export function computeQualityWeights(level: number): WeightedQuality[] {
  const bias = clamp((level - 1) * 0.01, 0, 0.2);
  return ITEM_QUALITY_ORDER.map((quality) => {
    const rank = ITEM_QUALITY_PRIORITY[quality] ?? 0;
    const rarityPenalty = 1 + rank * 0.75;
    const bonus = 1 + bias * rank * 1.45;
    return {
      quality,
      weight: Math.max(0.01, (1 / rarityPenalty) * bonus),
    };
  });
}

export function rollQualityForLevel(
  level: number,
  rng: () => number = Math.random,
): ItemQualityType {
  const weights = computeQualityWeights(level);
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of weights) {
    if (roll <= entry.weight) {
      return entry.quality;
    }
    roll -= entry.weight;
  }
  return weights[weights.length - 1]?.quality ?? ITEM_QUALITY_ORDER[0];
}

export function expectedRankForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_SCALE, Math.floor(level)));
  const rank = Math.ceil((clamped / MAX_PLAYER_SCALE) * MAX_ITEM_RANK);
  return Math.max(1, Math.min(MAX_ITEM_RANK, rank));
}

export function pickTemplatesForLevel(
  level: number,
  count: number,
  rng: () => number = Math.random,
): ItemTemplateSeed[] {
  const weighted = computeTemplateWeights(level);
  const picks: ItemTemplateSeed[] = [];
  const entries = [...weighted];
  for (let i = 0; i < Math.max(1, count) && entries.length > 0; i++) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < entries.length; idx++) {
      roll -= entries[idx].weight;
      if (roll <= 0) break;
    }
    if (idx >= entries.length) idx = entries.length - 1;
    picks.push(entries[idx].template);
    entries.splice(idx, 1);
  }
  return picks;
}

/**
 * Compute exponential rarity weights for shop inventory.
 * More rare items have exponentially lower chance to appear.
 */
export function computeShopTemplateWeights(
  level: number,
): WeightedItemTemplate[] {
  const clampedLevel = Math.max(1, Math.min(level, MAX_PLAYER_SCALE));
  return ITEM_TEMPLATES.map((template) => {
    const rarityRank = ITEM_QUALITY_PRIORITY[template.rarity] ?? 0;
    // Exponential decay: higher rarities are still rare, but not unattainable.
    // Base weight starts at 100 for Trash (rank 0), drops exponentially.
    const exponentialPenalty = Math.pow(1.7, rarityRank);
    const baseWeight = 100 / exponentialPenalty;

    // Apply rank-based relevance (prefer items near player level)
    const expected = expectedRankForLevel(clampedLevel);
    const r = template.rank ?? 1;
    const rankDistance = Math.abs(r - expected);
    const rankPenalty = 1 + rankDistance * 0.3;

    const weight = Math.max(0.01, baseWeight / rankPenalty);
    return { template, weight };
  });
}

/**
 * Pick random items for shop using exponential rarity weighting.
 * Rare items have much lower chance to appear than common items.
 */
export function pickShopTemplatesForLevel(
  level: number,
  count: number,
  rng: () => number = Math.random,
): ItemTemplateSeed[] {
  const weighted = computeShopTemplateWeights(level);
  const picks: ItemTemplateSeed[] = [];
  const entries = [...weighted];
  for (let i = 0; i < Math.max(1, count) && entries.length > 0; i++) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < entries.length; idx++) {
      roll -= entries[idx].weight;
      if (roll <= 0) break;
    }
    if (idx >= entries.length) idx = entries.length - 1;
    picks.push(entries[idx].template);
    entries.splice(idx, 1);
  }
  return picks;
}

export function stripTemplateForDb(
  template: ItemTemplateSeed,
): ItemTemplateSeed {
  return template;
}

export {
  MAX_ITEM_RANK,
  MAX_PLAYER_SCALE,
  ITEM_TEMPLATES,
  ITEM_RARITY_LOOKUP,
  ITEM_QUALITY_ORDER,
  ITEM_QUALITY_PRIORITY,
};
