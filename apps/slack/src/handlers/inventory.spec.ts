jest.mock('../dm-client', () => ({
  getPlayerItems: jest.fn(),
}));

import type { SayMessage } from './types';
import { inventoryHandler, __private__ } from './inventory';
import { getPlayerItems } from '../dm-client';
import { COMMANDS } from '../commands';

const mockedGetPlayer = getPlayerItems as unknown as jest.MockedFunction<
  typeof getPlayerItems
>;

describe('inventory handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats equipment slot values', () => {
    const { formatSlotValue } = __private__;
    expect(formatSlotValue(null)).toBe('_Empty_');
    expect(formatSlotValue(undefined)).toBe('_Empty_');
    expect(formatSlotValue(12)).toBe('Item #12');
  });

  it('builds an inventory message with equipment slots', () => {
    const { buildInventoryMessage } = __private__;
    const message = buildInventoryMessage({
      id: 1,
      name: 'Hero',
      level: 3,
      gold: 42,
      hp: 15,
      maxHp: 20,
      x: 1,
      y: 2,
      equipment: {
        head: null,
        chest: 5,
        legs: null,
        arms: 7,
        weapon: 9,
      },
    });

    expect(message.blocks).toBeDefined();
    const section = message.blocks?.find(
      (block) => block.type === 'section' && 'text' in block,
    ) as Extract<SayMessage['blocks'][number], { type: 'section' }> | undefined;
    expect(section?.text?.type).toBe('mrkdwn');
    expect(section?.text?.text).toContain('*Head:* _Empty_');
    expect(section?.text?.text).toContain('*Chest:* Item #5');
  });

  it('notifies when the player has no character', async () => {
    mockedGetPlayer.mockResolvedValue({
      success: false,
      message: 'No character found',
    } as never);
    const say = jest.fn<Promise<void>, [SayMessage]>().mockResolvedValue();

    await inventoryHandler({
      userId: 'U1',
      text: COMMANDS.INVENTORY,
      say,
    } as unknown as Parameters<typeof inventoryHandler>[0]);

    expect(say).toHaveBeenCalledWith({ text: 'No character found' });
  });

  it('sends inventory blocks when the player exists', async () => {
    mockedGetPlayer.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: 'Hero',
        level: 5,
        gold: 100,
        hp: 25,
        maxHp: 30,
        x: 0,
        y: 0,
        equipment: {
          head: null,
          chest: null,
          legs: 8,
          arms: null,
          weapon: null,
        },
      },
    } as never);
    const say = jest.fn<Promise<void>, [SayMessage]>().mockResolvedValue();

    await inventoryHandler({
      userId: 'U1',
      text: COMMANDS.INVENTORY,
      say,
    } as unknown as Parameters<typeof inventoryHandler>[0]);

    expect(mockedGetPlayer).toHaveBeenCalledWith({ slackId: 'slack:U1' });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.any(Array),
      }),
    );
  });

  it('reports a friendly error when loading fails', async () => {
    mockedGetPlayer.mockRejectedValue(new Error('boom'));
    const say = jest.fn<Promise<void>, [SayMessage]>().mockResolvedValue();

    await inventoryHandler({
      userId: 'U1',
      text: COMMANDS.INVENTORY,
      say,
    } as unknown as Parameters<typeof inventoryHandler>[0]);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});
