import { LootGenerator } from './loot-generator';
import type { PrismaClient } from '@mud/database';

describe('LootGenerator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns drops enriched with item details when prisma lookup succeeds', async () => {
    const prisma = {
      item: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'Sword' }) },
    } as unknown as PrismaClient;
    jest.spyOn(Math, 'random').mockReturnValue(0.1);

    const generator = new LootGenerator(prisma);
    const drops = await generator.generateForMonster({ level: 3 });

    expect(prisma.item.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(drops).toEqual([
      expect.objectContaining({
        itemId: 1,
        quality: 'Common',
        quantity: 1,
        item: { id: 1, name: 'Sword' },
      }),
    ]);
  });

  it('sets item to null when prisma lookup fails', async () => {
    const prisma = {
      item: { findUnique: jest.fn().mockRejectedValue(new Error('boom')) },
    } as unknown as PrismaClient;
    jest.spyOn(Math, 'random').mockReturnValue(0.2);

    const generator = new LootGenerator(prisma);
    const drops = await generator.generateForMonster({ level: 2 });

    expect(drops[0]?.item).toBeNull();
  });

  it('biases quality toward better tiers at higher levels', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.55);
    const generator = new LootGenerator();

    const lowLevelDrop = await generator.generateForMonster({ level: 1 });
    const highLevelDrop = await generator.generateForMonster({ level: 25 });

    expect(lowLevelDrop[0]?.quality).toBe('Common');
    expect(highLevelDrop[0]?.quality).toBe('Uncommon');
  });

  it('can roll rare and epic tiers based on random value', async () => {
    const generator = new LootGenerator();
    const randomSpy = jest.spyOn(Math, 'random');

    randomSpy.mockReturnValueOnce(0.9); // Rare branch
    const rareDrop = await generator.generateForMonster();
    expect(rareDrop[0]?.quality).toBe('Rare');

    randomSpy.mockReturnValueOnce(0.98); // Epic branch
    const epicDrop = await generator.generateForMonster();
    expect(epicDrop[0]?.quality).toBe('Epic');
  });
});
