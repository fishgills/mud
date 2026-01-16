import type { Block, KnownBlock, SectionBlock } from '@slack/types';
import { buildPlayerStatsMessage } from './format';
import type { PlayerStatsSource } from './types';

describe('buildPlayerStatsMessage', () => {
  const createMockPlayer = (
    overrides: Partial<PlayerStatsSource> = {},
  ): PlayerStatsSource => ({
    id: 1,
    slackUser: { id: 77, teamId: 'T1', userId: 'U123' },
    name: 'Test Player',
    hp: 50,
    maxHp: 100,
    strength: 10,
    agility: 12,
    health: 14,
    gold: 100,
    xp: 50,
    level: 2,
    skillPoints: 0,
    isAlive: true,
    xpToNextLevel: 250,
    ...overrides,
  });

  describe('stat display', () => {
    it('should display all player stats correctly', () => {
      const player = createMockPlayer();
      const result = buildPlayerStatsMessage(player);

      expect(result.text).toContain('Test Player');
      expect(result.text).toContain('Level 2');
      expect(result.text).toContain('HP 50/100');
      expect(result.blocks).toBeDefined();
    });

    it('should handle null/undefined skillPoints gracefully', () => {
      const player = createMockPlayer({ skillPoints: undefined });
      const result = buildPlayerStatsMessage(player);

      expect(result.blocks).toBeDefined();
      // Should still display the stats without crashing
      const sectionBlocks = result.blocks?.filter(isSectionBlock);
      expect(sectionBlocks.length).toBeGreaterThan(0);
    });
  });

  describe('combat stat breakdowns', () => {
    it('should show ratings and mitigation with gear contributions', () => {
      const player = createMockPlayer({
        strength: 14,
        agility: 12,
        equipmentTotals: {
          strengthBonus: 5,
          agilityBonus: 3,
          healthBonus: 2,
        },
      });
      const result = buildPlayerStatsMessage(player);

      const attackField = findFieldText(result.blocks, '*Attack Rating*');
      const defenseField = findFieldText(result.blocks, '*Defense Rating*');
      const damageField = findFieldText(result.blocks, '*Avg Base Damage*');
      const mitigationField = findFieldText(result.blocks, '*Mitigation*');

      expect(attackField).toBeDefined();
      expect(defenseField).toBeDefined();
      expect(damageField).toContain('weapon 1d4');
      expect(mitigationField).toBeDefined();
    });

    it('should show ratings even without gear bonuses', () => {
      const player = createMockPlayer({
        strength: 16,
        agility: 10,
        equipmentTotals: {
          strengthBonus: 0,
          agilityBonus: 0,
          healthBonus: 0,
        },
      });
      const result = buildPlayerStatsMessage(player);

      const attackField = findFieldText(result.blocks, '*Attack Rating*');
      const defenseField = findFieldText(result.blocks, '*Defense Rating*');
      const damageField = findFieldText(result.blocks, '*Avg Base Damage*');

      expect(attackField ?? '').toMatch(/\d/);
      expect(defenseField ?? '').toMatch(/\d/);
      expect(damageField).toContain('weapon 1d4');
    });
  });

  describe('XP progression display', () => {
    it('includes xp remaining and context details', () => {
      const player = createMockPlayer({ level: 2, xpToNextLevel: 250 });
      const result = buildPlayerStatsMessage(player);

      const xpField = findFieldText(result.blocks, '*XP to Next Level*');
      expect(xpField).toContain('250 XP');
      const contextTexts = findContextTexts(result.blocks);
      expect(contextTexts.some((text) => text.includes('level 3'))).toBe(true);
    });

    it('gracefully handles missing xp data', () => {
      const player = createMockPlayer({ xpToNextLevel: undefined });
      const result = buildPlayerStatsMessage(player);

      const xpField = findFieldText(result.blocks, '*XP to Next Level*');
      expect(xpField).toContain('—');
      const contextTexts = findContextTexts(result.blocks);
      expect(contextTexts.length).toBe(1);
      expect(contextTexts[0]).toContain('Skill points available');
    });
  });
});
const isSectionBlock = (block: KnownBlock | Block): block is SectionBlock =>
  block.type === 'section';

const isContextBlock = (block: KnownBlock | Block): block is Block =>
  block.type === 'context';

const findFieldText = (
  blocks: (KnownBlock | Block)[] | undefined,
  label: string,
): string | undefined => {
  if (!blocks) return undefined;
  for (const block of blocks) {
    if (!isSectionBlock(block)) continue;
    for (const field of block.fields ?? []) {
      if ('text' in field && field.text.includes(label)) {
        return field.text;
      }
    }
  }
  return undefined;
};

const findContextTexts = (
  blocks: (KnownBlock | Block)[] | undefined,
): string[] => {
  if (!blocks) return [];
  const texts: string[] = [];
  for (const block of blocks) {
    if (!isContextBlock(block)) continue;
    for (const element of block.elements ?? []) {
      if ('text' in element && typeof element.text === 'string') {
        texts.push(element.text);
      }
    }
  }
  return texts;
};
