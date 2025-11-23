import { LootGenerator } from './loot-generator';
import { ITEM_TEMPLATES, ITEM_QUALITY_PRIORITY } from '@mud/constants';
import type { PrismaClient, Item } from '@mud/database';

const mockItem = (overrides: Partial<Item> = {}): Item => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? 'Rusty Dagger',
  type: overrides.type ?? 'weapon',
  description: overrides.description ?? 'desc',
  value: overrides.value ?? 1,
  damageRoll: overrides.damageRoll ?? '1d4',
  defense: overrides.defense ?? 0,
  slot: overrides.slot ?? 'weapon',
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

describe('LootGenerator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns drops enriched with item details when prisma lookup succeeds', async () => {
    const record = mockItem({ id: 42, name: 'Rusty Dagger' });
    const prisma = {
      item: {
        findFirst: jest.fn().mockResolvedValue(record),
      },
    } as unknown as PrismaClient;
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.1);

    const generator = new LootGenerator(prisma);
    const drops = await generator.generateForMonster({ level: 3 });

    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { name: ITEM_TEMPLATES[0]?.name },
    });
    expect(drops).toEqual([
      expect.objectContaining({
        itemId: 42,
        quality: 'Trash',
        item: record,
      }),
    ]);
  });

  it('falls back to the first available item when the named template is missing', async () => {
    const fallback = mockItem({ id: 7, name: 'Fallback' });
    const prisma = {
      item: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(fallback),
      },
    } as unknown as PrismaClient;
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.2);

    const generator = new LootGenerator(prisma);
    const drops = await generator.generateForMonster({ level: 5 });

    expect(prisma.item.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: 'asc' } }),
    );
    expect(drops[0]?.itemId).toBe(7);
    expect(drops[0]?.item).toEqual(fallback);
  });

  it('biases quality toward better tiers at higher levels', async () => {
    const record = mockItem();
    const prisma = {
      item: { findFirst: jest.fn().mockResolvedValue(record) },
    } as unknown as PrismaClient;
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.35) // low level quality roll
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.35); // reuse same roll for higher level bias

    const generator = new LootGenerator(prisma);
    const lowLevelDrop = await generator.generateForMonster({ level: 1 });
    const highLevelDrop = await generator.generateForMonster({ level: 25 });

    const lowRank =
      ITEM_QUALITY_PRIORITY[lowLevelDrop[0]?.quality ?? 'Common'] ?? 0;
    const highRank =
      ITEM_QUALITY_PRIORITY[highLevelDrop[0]?.quality ?? 'Common'] ?? 0;

    expect(highRank).toBeGreaterThanOrEqual(lowRank);
  });

  it('can roll rare, epic, and legendary tiers based on random value', async () => {
    const record = mockItem();
    const prisma = {
      item: { findFirst: jest.fn().mockResolvedValue(record) },
    } as unknown as PrismaClient;
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.73) // Rare
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.79) // Epic
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.82); // Legendary

    const generator = new LootGenerator(prisma);
    const rareDrop = await generator.generateForMonster();
    const epicDrop = await generator.generateForMonster();
    const legendaryDrop = await generator.generateForMonster();

    expect(rareDrop[0]?.quality).toBe('Rare');
    expect(epicDrop[0]?.quality).toBe('Epic');
    expect(legendaryDrop[0]?.quality).toBe('Legendary');
  });
});
