import type {
  ActionsBlock,
  Block,
  KnownBlock,
  SectionBlock,
} from '@slack/types';
import { buildPlayerStatsMessage } from './format';
import type { PlayerStatsSource } from './types';

describe('buildPlayerStatsMessage', () => {
  const createMockPlayer = (
    overrides: Partial<PlayerStatsSource> = {},
  ): PlayerStatsSource => ({
    id: '1',
    teamId: 'T1',
    userId: 'U123',
    slackUser: { id: 77, teamId: 'T1', userId: 'U123' },
    name: 'Test Player',
    x: 10,
    y: 20,
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

  describe('skill point action buttons', () => {
    it('should not include action buttons when skillPoints is 0', () => {
      const player = createMockPlayer({ skillPoints: 0 });
      const result = buildPlayerStatsMessage(player, { isSelf: true });

      // Check that there are no action blocks
      const actionBlocks = result.blocks?.filter(isActionsBlock);
      expect(actionBlocks).toHaveLength(0);
    });

    it('should not include action buttons when skillPoints is negative', () => {
      const player = createMockPlayer({ skillPoints: -1 });
      const result = buildPlayerStatsMessage(player, { isSelf: true });

      // Check that there are no action blocks
      const actionBlocks = result.blocks?.filter(isActionsBlock);
      expect(actionBlocks).toHaveLength(0);
    });

    it('should include action buttons when skillPoints is positive', () => {
      const player = createMockPlayer({ skillPoints: 2 });
      const result = buildPlayerStatsMessage(player, { isSelf: true });

      // Check that there is exactly one action block
      const actionBlocks = result.blocks?.filter(isActionsBlock);
      expect(actionBlocks).toHaveLength(1);
      expect(actionBlocks?.[0]).toHaveProperty('elements');
      expect(actionBlocks?.[0].elements).toHaveLength(3); // Strength, Agility, Health buttons
    });

    it('should not include action buttons when isSelf is false, even with positive skillPoints', () => {
      const player = createMockPlayer({ skillPoints: 2 });
      const result = buildPlayerStatsMessage(player, { isSelf: false });

      // Check that there are no action blocks
      const actionBlocks = result.blocks?.filter(isActionsBlock);
      expect(actionBlocks).toHaveLength(0);
    });

    it('should not include action buttons when isSelf is undefined, even with positive skillPoints', () => {
      const player = createMockPlayer({ skillPoints: 2 });
      const result = buildPlayerStatsMessage(player);

      // Check that there are no action blocks
      const actionBlocks = result.blocks?.filter(isActionsBlock);
      expect(actionBlocks).toHaveLength(0);
    });
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
    it('should show attack, damage, and armor with base and gear contributions', () => {
      const player = createMockPlayer({
        strength: 14,
        agility: 12,
        equipmentTotals: {
          attackBonus: 3,
          damageBonus: 5,
          armorBonus: 2,
          vitalityBonus: 0,
        },
      });
      const result = buildPlayerStatsMessage(player);

      const attackField = findFieldText(result.blocks, '*Attack*');
      const damageField = findFieldText(result.blocks, '*Damage*');
      const armorField = findFieldText(result.blocks, '*Armor*');

      expect(attackField).toContain('+5 (base +2, +3 gear)');
      expect(damageField).toContain('+7 (base +2, +5 gear)');
      expect(armorField).toContain('13 (base 11, +2 gear)');
    });

    it('should show base attack/damage/armor even without gear bonuses', () => {
      const player = createMockPlayer({
        strength: 16,
        agility: 10,
        equipmentTotals: {
          attackBonus: 0,
          damageBonus: 0,
          armorBonus: 0,
          vitalityBonus: 0,
        },
      });
      const result = buildPlayerStatsMessage(player);

      const attackField = findFieldText(result.blocks, '*Attack*');
      const damageField = findFieldText(result.blocks, '*Damage*');
      const armorField = findFieldText(result.blocks, '*Armor*');

      expect(attackField).toContain('+3 (base +3)');
      expect(damageField).toContain('+3 (base +3)');
      expect(armorField).toContain('10 (base 10)');
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
      expect(contextTexts.length).toBe(0);
    });
  });
});
const isActionsBlock = (block: KnownBlock | Block): block is ActionsBlock =>
  block.type === 'actions';

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
