import { ItemController } from './item.controller';

const mockPrisma = {
  item: {
    findUnique: jest.fn(),
  },
};

jest.mock('@mud/database', () => ({
  getPrismaClient: () => mockPrisma,
}));

describe('ItemController', () => {
  let controller: ItemController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ItemController();
  });

  it('rejects invalid ids before hitting prisma', async () => {
    await expect(controller.getItemById('abc')).resolves.toEqual({
      success: false,
      message: 'Invalid item id',
    });
    expect(mockPrisma.item.findUnique).not.toHaveBeenCalled();
  });

  it('returns item data when found', async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: 2,
      name: 'Sword',
      type: 'weapon',
      description: 'Sharp',
      value: 10,
      damageRoll: '1d6',
      defense: 0,
      slot: 'weapon',
    });

    const response = await controller.getItemById('2');

    expect(mockPrisma.item.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
    });
    expect(response).toEqual({
      success: true,
      data: expect.objectContaining({ name: 'Sword', slot: 'weapon' }),
    });
  });

  it('handles missing items and thrown errors', async () => {
    mockPrisma.item.findUnique.mockResolvedValue(null);
    expect(await controller.getItemById('3')).toEqual({
      success: false,
      message: 'Item not found',
    });

    mockPrisma.item.findUnique.mockRejectedValue(new Error('boom'));
    expect(await controller.getItemById('3')).toEqual({
      success: false,
      message: 'boom',
    });
  });
});
