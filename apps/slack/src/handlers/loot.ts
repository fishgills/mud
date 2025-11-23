import { COMMANDS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import {
  ITEM_TEMPLATES,
  ITEM_QUALITY_ORDER,
  computeTemplateWeights,
  computeQualityWeights,
  pickTemplateForLevel,
  type ItemTemplateSeed,
  type ItemSpawnRarity,
} from '@mud/constants';

const formatTemplate = (template: ItemTemplateSeed) => {
  const parts = [template.type.toLowerCase()];
  if (typeof template.rank === 'number') parts.unshift(`rank ${template.rank}`);
  if (template.slot) parts.push(`slot: ${template.slot}`);
  if (template.damageRoll) {
    parts.push(`dmg ${template.damageRoll}`);
  }
  if (typeof template.defense === 'number' && template.defense !== 0) {
    parts.push(`def ${template.defense}`);
  }
  return `${template.name} (rank ${template.rank ?? '—'} ${template.rarity}, weight ${template.dropWeight}) — ${parts.join(', ')}`;
};

const createRarityTotals = (): Record<ItemSpawnRarity, number> =>
  ITEM_QUALITY_ORDER.reduce<Record<ItemSpawnRarity, number>>(
    (acc, rarity) => {
      acc[rarity] = 0;
      return acc;
    },
    {} as Record<ItemSpawnRarity, number>,
  );

const countTemplatesByRarity = (): Record<ItemSpawnRarity, number> =>
  ITEM_TEMPLATES.reduce<Record<ItemSpawnRarity, number>>((acc, template) => {
    acc[template.rarity] = (acc[template.rarity] ?? 0) + 1;
    return acc;
  }, createRarityTotals());

const buildRaritySummary = (level: number) => {
  const weighted = computeTemplateWeights(level);
  const totals = weighted.reduce<Record<ItemSpawnRarity, number>>(
    (acc, entry) => {
      acc[entry.template.rarity] += entry.weight;
      return acc;
    },
    createRarityTotals(),
  );
  const counts = countTemplatesByRarity();
  const lines = ITEM_QUALITY_ORDER.map((rarity) => {
    const weight = totals[rarity];
    const count = counts[rarity];
    const suffix = count
      ? ` (${count} template${count === 1 ? '' : 's'})`
      : ' (no base templates)';
    return `${rarity}: total weight ${weight.toFixed(1)}${suffix}`;
  }).join('\n');
  return lines;
};

const buildQualitySummary = (level: number) => {
  const weights = computeQualityWeights(level);
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  return weights
    .map(({ quality, weight }) => {
      const percent = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      return `${quality}: weight ${weight.toFixed(2)} (${percent.toFixed(1)}%)`;
    })
    .join('\n');
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

  const samples = Array.from({ length: 5 }, () => pickTemplateForLevel(level));
  const sampleLines = samples.map(
    (template, index) => `${index + 1}. ${formatTemplate(template)}`,
  );

  const templateSummary = buildRaritySummary(level);
  const qualitySummary = buildQualitySummary(level);
  await say({
    text: `Loot preview for level ${level}:\n${sampleLines.join('\n')}\n\nBase item weights (by template rarity — 0 means no templates at that tier):\n${templateSummary}\n\nQuality roll weights (final drop quality):\n${qualitySummary}\nUse \`${COMMANDS.LOOT} <level>\` to sample a different level.`,
  });
});
