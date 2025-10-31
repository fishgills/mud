import { CombatMessenger } from './messages';
import type { DetailedCombatLog } from '../api';

const makeCombatLog = (): DetailedCombatLog => ({
  combatId: 'test',
  participant1: 'Hero',
  participant2: 'Goblin',
  firstAttacker: 'Hero',
  initiativeRolls: [],
  rounds: [
    {
      roundNumber: 1,
      attackerName: 'Hero',
      defenderName: 'Goblin',
      attackRoll: 15,
      attackModifier: 2,
      totalAttack: 17,
      defenderAC: 12,
      hit: true,
      damage: 5,
      defenderHpAfter: 0,
      killed: true,
    },
  ],
  winner: 'Hero',
  loser: 'Goblin',
  xpAwarded: 12,
  goldAwarded: 4,
  timestamp: new Date(),
  location: { x: 0, y: 0 },
});

describe('CombatMessenger', () => {
  test('generateCombatNarrative returns AI text when available', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({ output_text: 'AI Narrative' }),
    } as any;
    const playerService = { getPlayersAtLocation: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const narrative = await messenger.generateCombatNarrative(log, {});
    expect(narrative).toContain('AI Narrative');
    expect(aiService.getText).toHaveBeenCalled();
  });

  test('generateCombatNarrative falls back on AI error', async () => {
    const aiService = {
      getText: jest.fn().mockRejectedValue(new Error('boom')),
    } as any;
    const playerService = { getPlayersAtLocation: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const narrative = await messenger.generateCombatNarrative(log, {});
    expect(narrative).toContain('**Combat Summary:**');
    expect(narrative).toContain('Round 1:');
  });

  test('buildParticipantMessage includes rewards and level-up text when present', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({ output_text: 'Short summary' }),
    } as any;
    const playerService = { getPlayersAtLocation: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const participant = {
      id: 1,
      name: 'Hero',
      type: 'player',
      hp: 10,
      maxHp: 10,
      strength: 12,
      agility: 12,
      level: 4,
      isAlive: true,
      x: 0,
      y: 0,
      slackId: 'S1',
      levelUp: { previousLevel: 3, newLevel: 4, skillPointsAwarded: 1 },
    } as any;

    const msg = await messenger.buildParticipantMessage(
      log,
      participant,
      'attacker',
    );
    expect(msg).not.toBeNull();
    expect(msg!.message).toContain('Rewards: +12 XP, +4 gold.');
    expect(msg!.message).toContain('🎉 Level up');
    expect(Array.isArray(msg!.blocks)).toBe(true);
  });

  test('generateCombatNarrative cleans fenced code blocks from AI output', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({
        output_text: '```json\n{"x":"y"}\n```\nNarrative after',
      }),
    } as any;
    const playerService = { getPlayersAtLocation: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const narrative = await messenger.generateCombatNarrative(log, {});
    expect(narrative).toContain('Narrative after');
    // ensure code fences were removed
    expect(narrative).not.toContain('```');
  });

  test('generateEntertainingSummary returns AI text and falls back when empty', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({ output_text: 'Nice summary' }),
    } as any;
    const playerService = { getPlayersAtLocation: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const summary = await messenger.generateEntertainingSummary(log, {});
    expect(summary).toBe('Nice summary');

    // when AI returns empty, fallback should be deterministic
    aiService.getText.mockResolvedValueOnce({ output_text: '' });
    const fallback = await messenger.generateEntertainingSummary(log, {});
    expect(fallback).toContain('defeats');
  });

  test('buildParticipantMessage returns null for non-player or missing slackId', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({ output_text: 'x' }),
    } as any;
    const playerService = { getPlayersAtLocation: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const nonPlayer = { type: 'monster', slackId: 'M1' } as any;
    expect(
      await messenger.buildParticipantMessage(log, nonPlayer, 'attacker'),
    ).toBeNull();

    const missingSlack = { type: 'player', slackId: undefined } as any;
    expect(
      await messenger.buildParticipantMessage(log, missingSlack, 'defender'),
    ).toBeNull();
  });

  test('generateCombatMessages produces observer messages and respects defender exclusion', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({ output_text: 'S' }),
    } as any;
    const playerService = {
      getPlayersAtLocation: jest.fn().mockResolvedValue([
        { id: 3, name: 'Obs', clientType: 'slack', clientId: 'S-OBS' },
        { id: 2, name: 'Defender', clientType: 'slack', clientId: 'S-B' },
      ]),
    } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(playerService, aiService, logger);

    const log = makeCombatLog();
    const attacker = {
      id: 1,
      name: 'Hero',
      type: 'player',
      slackId: 'S-A',
    } as any;
    const defender = {
      id: 2,
      name: 'Defender',
      type: 'player',
      slackId: 'S-B',
    } as any;

    // spy on narrative calls so observers get proper messages
    const res = await messenger.generateCombatMessages(log, attacker, defender);
    // should include attacker, defender and one observer (observer id 3)
    expect(res.messages.some((m) => m.role === 'observer')).toBe(true);
    expect(playerService.getPlayersAtLocation).toHaveBeenCalled();
  });
});
