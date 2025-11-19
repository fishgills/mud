import {
  buildLocationBlocks,
  formatLocationMessage,
  sanitizeDescription,
  sendOccupantsSummary,
} from './locationUtils';
import type { PlayerRecord } from '../dm-client';

const hasContextElements = (
  block: unknown,
): block is { elements: Array<{ text?: string }> } =>
  Boolean(
    block &&
      typeof block === 'object' &&
      'elements' in block &&
      Array.isArray((block as { elements?: unknown }).elements),
  );

const baseData = {
  location: {
    x: 5,
    y: -2,
    biomeName: 'forest',
    description: 'Lush and green',
  },
  description: '```json\n{"ignored":true}\n```You stand in a clearing.',
  surroundingTiles: [
    { direction: 'north', biomeName: 'mountain', description: 'Snowy peaks' },
    { direction: 'south', biomeName: 'swamp' },
  ],
  monsters: [
    { id: '1', name: 'Goblin', hp: 6 },
    { id: '2', name: 'Orc' },
  ],
  playerInfo: 'Party members: Alice, Bob',
};

describe('sanitizeDescription', () => {
  it('strips code fences and collapses whitespace', () => {
    const input = '```slack\nblock content\n```\n\n\nRemaining text';
    expect(sanitizeDescription(input)).toBe('Remaining text');
  });

  it('handles invalid input gracefully', () => {
    expect(sanitizeDescription(null as unknown as string)).toBeNull();
  });
});

describe('formatLocationMessage', () => {
  it('assembles a readable narrative with optional move direction', () => {
    const message = formatLocationMessage(baseData, 'north');

    expect(message).toContain('You moved north');
    expect(message).toContain('You are now at (5, -2) in a forest biome');
    expect(message).toContain('You stand in a clearing.');
    expect(message).toContain('Nearby tiles:');
    expect(message).toContain('- north: mountain (Snowy peaks)');
    expect(message).toContain('Monsters nearby: Goblin, Orc');
    expect(message).toContain('Party members: Alice, Bob');
  });

  it('omits optional sections when data is missing', () => {
    const message = formatLocationMessage({ location: baseData.location });

    expect(message).not.toContain('Nearby tiles:');
    expect(message).not.toContain('Monsters nearby:');
  });
});

describe('buildLocationBlocks', () => {
  it('creates structured blocks with debug context by default', () => {
    const blocks = buildLocationBlocks(baseData, 'west');

    expect(blocks[0]).toMatchObject({
      type: 'section',
      text: { text: '*You moved west.*', type: 'mrkdwn' },
    });
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'section' }),
        expect.objectContaining({ type: 'divider' }),
        expect.objectContaining({
          type: 'context',
          elements: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Debug: x=5, y=-2'),
            }),
          ]),
        }),
      ]),
    );
  });

  it('can omit debug information when requested', () => {
    const blocks = buildLocationBlocks(baseData, undefined, {
      includeDebug: false,
    });

    const debugBlock = blocks.find(
      (block) =>
        hasContextElements(block) &&
        block.elements.some((el) => el.text?.includes('Debug:')),
    );

    expect(debugBlock).toBeUndefined();
  });
});

describe('sendOccupantsSummary', () => {
  it('omits the current Slack user when slackUser relation is present', async () => {
    const say = jest.fn();
    const players: PlayerRecord[] = [
      {
        id: 1,
        name: 'Self Player',
        slackUser: { userId: 'U1', teamId: 'T1' },
        userId: 'U1',
        teamId: 'T1',
        isInHq: true,
        x: 0,
        y: 0,
        z: 0,
        gold: 0,
        xp: 0,
        level: 1,
        hp: 10,
        maxHp: 10,
        strength: 5,
        agility: 5,
        health: 5,
        isAlive: true,
        skillPoints: 0,
        isCreationComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAction: new Date(),
      } as unknown as PlayerRecord,
      {
        id: 2,
        name: 'Other Player',
        slackUser: { userId: 'U2', teamId: 'T1' },
        userId: 'U2',
        teamId: 'T1',
        isInHq: true,
        x: 0,
        y: 0,
        z: 0,
        gold: 0,
        xp: 0,
        level: 1,
        hp: 10,
        maxHp: 10,
        strength: 5,
        agility: 5,
        health: 5,
        isAlive: true,
        skillPoints: 0,
        isCreationComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAction: new Date(),
      } as unknown as PlayerRecord,
    ];
    await sendOccupantsSummary(say, players, [], {
      currentSlackUserId: 'U1',
      currentSlackTeamId: 'T1',
    });

    expect(say).toHaveBeenCalledTimes(1);
    const [{ text }] = say.mock.calls[0];
    expect(text).toContain('Other Player');
    expect(text).not.toContain('Self Player');
  });
});
