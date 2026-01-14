jest.mock('../dm-client', () => ({
  getPlayerItems: jest.fn(),
}));

import type { ActionsBlock, Button, SectionBlock } from '@slack/types';
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

  it('builds an inventory message that lists equipment slots once', () => {
    const { buildInventoryMessage } = __private__;
    const message = buildInventoryMessage({
      id: 1,
      name: 'Hero',
      level: 3,
      gold: 42,
      hp: 15,
      maxHp: 20,
      equipment: {
        head: null,
        chest: 5,
        legs: null,
        arms: 7,
        weapon: 9,
      },
    });

    expect(message.blocks).toBeDefined();
    const headBlock = (message.blocks ?? []).find((block) => {
      if (block.type !== 'section') return false;
      const sectionBlock = block as SectionBlock;
      return (
        sectionBlock.text?.type === 'mrkdwn' &&
        typeof sectionBlock.text.text === 'string' &&
        sectionBlock.text.text.includes('*Head*')
      );
    }) as SectionBlock | undefined;
    expect(headBlock?.text?.text).toContain('_Empty_');

    const chestBlock = (message.blocks ?? []).find((block) => {
      if (block.type !== 'section') return false;
      const sectionBlock = block as SectionBlock;
      return (
        sectionBlock.text?.type === 'mrkdwn' &&
        typeof sectionBlock.text.text === 'string' &&
        sectionBlock.text.text.includes('*Chest*')
      );
    }) as SectionBlock | undefined;
    expect(chestBlock?.text?.text).toContain('Item #5');
  });

  it('shows equipped controls and excludes equipped items from the backpack', () => {
    const { buildInventoryMessage } = __private__;
    const message = buildInventoryMessage({
      id: 1,
      name: 'Hero',
      level: 2,
      gold: 15,
      hp: 6,
      maxHp: 10,
      equipment: {
        head: null,
        chest: null,
        legs: null,
        arms: null,
        weapon: 101,
      },
      bag: [
        {
          id: 101,
          itemId: 12,
          itemName: 'Shortsword',
          quality: 'Uncommon',
          equipped: true,
          slot: 'weapon',
          allowedSlots: ['weapon'],
        },
        {
          id: 102,
          itemId: 13,
          itemName: 'Dagger',
          quality: 'Common',
          equipped: false,
          slot: null,
          allowedSlots: ['weapon'],
        },
      ],
    } as never);

    const actionBlocks = (message.blocks ?? []).filter(
      (block): block is ActionsBlock => block.type === 'actions',
    );
    const allButtons = actionBlocks.flatMap((block) =>
      (block.elements ?? []).filter((el): el is Button => el.type === 'button'),
    );

    const unequipButtons = allButtons.filter(
      (btn) => btn.action_id === 'inventory_unequip',
    );
    expect(unequipButtons.length).toBeGreaterThan(0);
    expect(unequipButtons.some((btn) => btn.value === '101')).toBe(true);

    const equipButtons = allButtons.filter(
      (btn) => btn.action_id === 'inventory_equip',
    );
    expect(equipButtons.some((btn) => btn.value?.includes('102'))).toBe(true);
    expect(equipButtons.every((btn) => !btn.value?.includes('101'))).toBe(true);

    const weaponSections = (message.blocks ?? []).filter((block) => {
      if (block.type !== 'section') return false;
      const sectionBlock = block as SectionBlock;
      return (
        sectionBlock.text?.type === 'mrkdwn' &&
        typeof sectionBlock.text.text === 'string' &&
        sectionBlock.text.text.includes('*Weapon*')
      );
    });
    expect(weaponSections).toHaveLength(1);
  });

  it('renders armor stats for items in the backpack', () => {
    const { buildInventoryMessage } = __private__;
    const message = buildInventoryMessage({
      id: 1,
      name: 'Hero',
      level: 2,
      gold: 5,
      hp: 8,
      maxHp: 12,
      equipment: {
        head: null,
        chest: null,
        legs: null,
        arms: null,
        weapon: null,
      },
      bag: [
        {
          id: 201,
          itemId: 99,
          itemName: 'Reinforced Leather',
          quality: 'Uncommon',
          equipped: false,
          slot: null,
          allowedSlots: ['chest'],
          computedBonuses: {
            attackBonus: 0,
            damageBonus: 0,
            armorBonus: 4,
            vitalityBonus: 0,
            weaponDamageRoll: null,
          },
        },
      ],
    } as never);

    const armorContext = (message.blocks ?? []).find(
      (block) =>
        block.type === 'context' &&
        Array.isArray(block.elements) &&
        block.elements.some(
          (element) =>
            element.type === 'mrkdwn' &&
            typeof element.text === 'string' &&
            element.text.includes('Armor +4'),
        ),
    );

    expect(armorContext).toBeDefined();
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
      teamId: 'T1',
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
      teamId: 'T1',
      say,
    } as unknown as Parameters<typeof inventoryHandler>[0]);

    expect(mockedGetPlayer).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
    });
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
      teamId: 'T1',
      say,
    } as unknown as Parameters<typeof inventoryHandler>[0]);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});
