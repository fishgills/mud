import type { ActionsBlock, Block, KnownBlock, SectionBlock } from '@slack/types';
import { buildPlayerStatsMessage } from './format';
import type { PlayerStatsSource } from './types';

describe('buildPlayerStatsMessage', () => {
  const createMockPlayer = (
    overrides: Partial<PlayerStatsSource> = {},
  ): PlayerStatsSource => ({
    id: '1',
    slackId: 'U123',
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
});
const isActionsBlock = (block: KnownBlock | Block): block is ActionsBlock =>
  block.type === 'actions';

const isSectionBlock = (block: KnownBlock | Block): block is SectionBlock =>
  block.type === 'section';
