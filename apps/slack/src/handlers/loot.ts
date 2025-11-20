import { COMMANDS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import {
  ITEM_TEMPLATES,
  ITEM_QUALITY_ORDER,
  ITEM_QUALITY_PRIORITY,
  type ItemTemplateSeed,
  type ItemSpawnRarity,
} from '@mud/constants';

const pickTemplate = (level: number): ItemTemplateSeed => {
  if (ITEM_TEMPLATES.length === 0) {
    throw new Error('No loot templates configured');
  }
  const levelBias = Math.min(0.6, Math.max(0, (level - 1) * 0.02));
  const weighted = ITEM_TEMPLATES.map((template) => {
    const rarityRank = ITEM_QUALITY_PRIORITY[template.rarity] ?? 0;
    const levelBoost = 1 + levelBias * rarityRank;
    const rarityPenalty = 1 + rarityRank * 0.8;
    const weight = Math.max(
      0.05,
      (template.dropWeight / rarityPenalty) * levelBoost,
    );
    return { template, weight };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (roll <= cumulative) {
      return entry.template;
    }
  }
  return weighted[weighted.length - 1]?.template ?? ITEM_TEMPLATES[0];
};

const formatTemplate = (template: ItemTemplateSeed) => {
  const parts = [template.type.toLowerCase()];
  if (template.slot) parts.push(`slot: ${template.slot}`);
  if (typeof template.attack === 'number' && template.attack !== 0) {
    parts.push(`atk ${template.attack}`);
  }
  if (typeof template.defense === 'number' && template.defense !== 0) {
    parts.push(`def ${template.defense}`);
  }
  if (typeof template.healthBonus === 'number' && template.healthBonus !== 0) {
    parts.push(`hp ${template.healthBonus}`);
  }
  return `${template.name} (${template.rarity}, weight ${template.dropWeight}) — ${parts.join(', ')}`;
};

const createRarityTotals = (): Record<ItemSpawnRarity, number> =>
  ITEM_QUALITY_ORDER.reduce<Record<ItemSpawnRarity, number>>(
    (acc, rarity) => {
      acc[rarity] = 0;
      return acc;
    },
    {} as Record<ItemSpawnRarity, number>,
  );

const buildRaritySummary = () => {
  const totals = ITEM_TEMPLATES.reduce<Record<ItemSpawnRarity, number>>(
    (acc, template) => {
      acc[template.rarity] += template.dropWeight;
      return acc;
    },
    createRarityTotals(),
  );
  const lines = ITEM_QUALITY_ORDER.map((rarity) => {
    const weight = totals[rarity];
    return `${rarity}: total weight ${weight.toFixed(1)}`;
  }).join('\n');
  return lines;
};

registerHandler(COMMANDS.LOOT, async ({ say, text }: HandlerContext) => {
  const args = (text || '').trim().split(/\s+/).slice(1);
  const requestedLevel = Number(args[0]);
  const level =
    Number.isFinite(requestedLevel) && requestedLevel > 0
      ? Math.min(100, Math.floor(requestedLevel))
      : 1;

  if (ITEM_TEMPLATES.length === 0) {
    await say({ text: 'No loot templates registered yet.' });
    return;
  }

  const samples = Array.from({ length: 5 }, () => pickTemplate(level));
  const sampleLines = samples.map(
    (template, index) => `${index + 1}. ${formatTemplate(template)}`,
  );

  const summary = buildRaritySummary();
  await say({
    text: `Loot preview for level ${level}:\n${sampleLines.join('\n')}\n\n${summary}\nUse \`${COMMANDS.LOOT} <level>\` to sample a different level.`,
  });
});
