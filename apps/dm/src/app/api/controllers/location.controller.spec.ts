import { LocationController } from './location.controller';
import { BadRequestException } from '@nestjs/common';

const createPlayerService = () => ({
  getPlayersAtLocation: jest.fn(),
});

const createMonsterService = () => ({
  getMonstersAtLocation: jest.fn(),
});

const createPlayerItemService = () => ({
  listWorldItemsAtLocation: jest.fn(),
});

describe('LocationController', () => {
  let controller: LocationController;
  let playerService: ReturnType<typeof createPlayerService>;
  let monsterService: ReturnType<typeof createMonsterService>;
  let playerItemService: ReturnType<typeof createPlayerItemService>;

  beforeEach(() => {
    playerService = createPlayerService();
    monsterService = createMonsterService();
    playerItemService = createPlayerItemService();
    controller = new LocationController(
      playerService as never,
      monsterService as never,
      playerItemService as never,
    );
  });

  it('requires both x and y coordinates', async () => {
    await expect(controller.getPlayersAtLocation('1', undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.getPlayersAtLocation('a', '1')).rejects.toThrow(
      'x and y must be numbers',
    );
  });

  it('returns players/monsters for a location', async () => {
    const entities = [{ id: 1 }];
    playerService.getPlayersAtLocation.mockResolvedValue(entities as never);
    monsterService.getMonstersAtLocation.mockResolvedValue(entities as never);

    const players = await controller.getPlayersAtLocation('3', '4');
    expect(playerService.getPlayersAtLocation).toHaveBeenCalledWith(3, 4);
    expect(players).toEqual({ success: true, data: entities });

    const monsters = await controller.getMonstersAtLocation('5', '6');
    expect(monsterService.getMonstersAtLocation).toHaveBeenCalledWith(5, 6);
    expect(monsters).toEqual({ success: true, data: entities });
  });

  it('serializes world items with derived allowed slots and names', async () => {
    playerItemService.listWorldItemsAtLocation.mockResolvedValue([
      {
        id: 1,
        x: 0,
        y: 0,
        itemId: 10,
        quality: 'Common',
        quantity: 1,
        spawnedByMonsterId: null,
        item: { name: 'Cloak', slot: 'chest' },
      },
      {
        id: 2,
        x: 0,
        y: 0,
        itemId: 11,
        quality: 'Common',
        quantity: 1,
        spawnedByMonsterId: null,
        item: { name: 'Dagger', type: 'weapon' },
      },
    ]);

    const response = await controller.getItemsAtLocation('0', '0');
    expect(playerItemService.listWorldItemsAtLocation).toHaveBeenCalledWith(0, 0);
    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(2);
    expect(response.data[0]).toMatchObject({
      itemName: 'Cloak',
      allowedSlots: ['chest'],
    });
    expect(response.data[1]).toMatchObject({
      itemName: 'Dagger',
      allowedSlots: ['weapon'],
    });
  });
});
