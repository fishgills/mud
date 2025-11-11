import { LootService } from './loot.service';
import type { WorldItem } from '@mud/database';

type MonsterDeathEvent = {
  monster: { id: number; level?: number };
  x: number;
  y: number;
};

const createPrismaMock = () => ({
  item: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  worldItem: {
    create: jest.fn(),
  },
});

const createGeneratorMock = () => ({
  generateForMonster: jest.fn(),
});

jest.mock('../../shared/event-bus', () => {
  const mockEventBus = {
    on: jest.fn(),
    emit: jest.fn(),
  };
  return {
    EventBus: mockEventBus,
  };
});

jest.mock('@mud/database', () => {
  const actual = jest.requireActual<typeof import('@mud/database')>(
    '@mud/database',
  );
  const PrismaClientMock = jest.fn();
  return {
    ...actual,
    PrismaClient: PrismaClientMock,
  };
});

jest.mock('./loot-generator', () => ({
  LootGenerator: jest.fn(),
}));

describe('LootService', () => {
  let service: LootService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let generator: ReturnType<typeof createGeneratorMock>;
  let logger: { debug: jest.Mock; warn: jest.Mock; error: jest.Mock };
  const { EventBus } = jest.requireMock('../../shared/event-bus') as {
    EventBus: { on: jest.Mock; emit: jest.Mock };
  };
  const { PrismaClient } = jest.requireMock('@mud/database') as {
    PrismaClient: jest.Mock;
  };
  const { LootGenerator } = jest.requireMock('./loot-generator') as {
    LootGenerator: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    generator = createGeneratorMock();
    PrismaClient.mockImplementation(() => prisma);
    LootGenerator.mockImplementation(() => generator);
    EventBus.on.mockReturnValue(() => undefined);
    service = new LootService();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    (service as unknown as { logger: typeof logger }).logger = logger;
  });

  const invokeHandler = async (
    payload?: Partial<MonsterDeathEvent>,
  ): Promise<void> => {
    const handler = (
      service as unknown as {
        handleMonsterDeath: (event: MonsterDeathEvent) => Promise<void>;
      }
    ).handleMonsterDeath;
    await handler.call(service, {
      monster: { id: 7, level: 3 },
      x: 4,
      y: 9,
      ...payload,
    });
  };

  it('persists validated drops and emits loot:spawn events with item names', async () => {
    const drops = [
      {
        itemId: 10,
        quality: 'Rare',
        quantity: 2,
        item: { id: 10, name: 'Crystal Blade' },
      },
    ];
    generator.generateForMonster.mockResolvedValue(drops);
    prisma.item.findMany.mockResolvedValue([{ id: 10 }]);
    prisma.worldItem.create.mockResolvedValue({
      id: 99,
      itemId: 10,
      quantity: 2,
      quality: 'Rare',
      x: 4,
      y: 9,
      spawnedByMonsterId: 7,
    } satisfies WorldItem);

    await invokeHandler();

    expect(prisma.worldItem.create).toHaveBeenCalledWith({
      data: {
        itemId: 10,
        quality: 'Rare',
        x: 4,
        y: 9,
        quantity: 2,
        spawnedByMonsterId: 7,
      },
    });
    expect(EventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'loot:spawn',
        drops: [
          expect.objectContaining({
            itemName: 'Crystal Blade',
          }),
        ],
      }),
    );
  });

  it('skips drops with invalid itemIds and warns once per issue', async () => {
    const drops = [
      { itemId: Number.NaN, quality: 'Common' },
      { itemId: 55, quality: 'Uncommon' },
    ];
    generator.generateForMonster.mockResolvedValue(drops);
    prisma.item.findMany.mockResolvedValue([{ id: 999 }]);

    await invokeHandler();

    expect(prisma.worldItem.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Skipping invalid drop with missing or non-numeric itemId',
      drops[0] as unknown as Error,
    );
    expect(logger.warn).toHaveBeenCalledWith('Skipping drop for unknown itemId=55');
    expect(EventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        drops: [],
      }),
    );
  });

  it('still emits loot events when validation query fails, logging the error', async () => {
    const drops = [
      { itemId: 5, quality: 'Common' },
      { itemId: 6, quality: 'Uncommon' },
    ];
    generator.generateForMonster.mockResolvedValue(drops);
    prisma.item.findMany.mockRejectedValue(new Error('db down'));

    await invokeHandler();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to validate item IDs before creating WorldItems',
      expect.any(Error),
    );
    expect(prisma.worldItem.create).not.toHaveBeenCalled();
    expect(EventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        drops: [],
      }),
    );
  });
});
