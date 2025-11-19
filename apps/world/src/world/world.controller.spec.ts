import { BadRequestException } from '@nestjs/common';
import { WorldController } from './world.controller';
import type { WorldService } from './world-refactored.service';
import type { ChunkData, TileWithNearbyBiomes, WorldTile } from './dto';

const makeWorldTile = (overrides: Partial<WorldTile> = {}): WorldTile => ({
  id: overrides.id ?? 1,
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  biomeId: overrides.biomeId ?? 1,
  biomeName: overrides.biomeName ?? 'plains',
  description: overrides.description ?? null,
  height: overrides.height ?? 0,
  temperature: overrides.temperature ?? 0,
  moisture: overrides.moisture ?? 0,
  seed: overrides.seed ?? 1,
  chunkX: overrides.chunkX ?? 0,
  chunkY: overrides.chunkY ?? 0,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  biome: overrides.biome ?? null,
});

describe('WorldController', () => {
  let controller: WorldController;
  let worldService: jest.Mocked<WorldService>;

  beforeEach(() => {
    worldService = {
      getTileWithNearbyBiomes: jest.fn(),
      getChunk: jest.fn(),
      getChunkTiles: jest.fn(),
      getChunkTileCount: jest.fn(),
      getTilesInBounds: jest.fn(),
    } as unknown as jest.Mocked<WorldService>;

    controller = new WorldController(worldService);
  });

  it('returns a simple health payload', () => {
    const result = controller.health();
    expect(result.status).toBe('healthy');
    expect(() => new Date(result.timestamp)).not.toThrow();
  });

  it('returns tiles with or without nearby data', async () => {
    const tileWithNearby: TileWithNearbyBiomes = {
      ...makeWorldTile(),
      nearbyBiomes: [],
    };
    worldService.getTileWithNearbyBiomes.mockResolvedValue(tileWithNearby);

    const minimal = await controller.getTile('0', '0');
    expect(minimal).toEqual(expect.objectContaining({ id: 1, x: 0, y: 0 }));

    const detailed = await controller.getTile('0', '0', 'true');
    expect(detailed).toHaveProperty('nearbyBiomes');

    await expect(controller.getTile('a', '0')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns chunks and can omit tile data', async () => {
    const chunkData: ChunkData = {
      chunkX: 0,
      chunkY: 0,
      tiles: [makeWorldTile()],
    };
    worldService.getChunk.mockResolvedValue(chunkData);

    const chunk = await controller.getChunk('0', '1', 'false');
    expect(chunk.tiles).toBeUndefined();
    const chunkWithTiles = await controller.getChunk('0', '1');
    expect(chunkWithTiles.tiles).toBeDefined();

    await expect(controller.getChunk('a', '1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('paginates chunk tiles and validates params', async () => {
    worldService.getChunkTiles.mockResolvedValue([makeWorldTile()]);
    worldService.getChunkTileCount.mockResolvedValue(10);

    const result = await controller.getChunkTiles('1', '2', '3', '2');
    expect(worldService.getChunkTiles).toHaveBeenCalledWith(1, 2, 3, 2);
    expect(result.hasMore).toBe(true);
    expect(result.offset).toBe(2);
    expect(result.limit).toBe(3);

    await expect(
      controller.getChunkTiles('1', '2', '-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.getChunkTiles('1', '2', '5', 'nope'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns tiles in bounds and enforces valid ranges', async () => {
    worldService.getTilesInBounds.mockResolvedValue([makeWorldTile()]);
    const tiles = await controller.getTilesInBounds('0', '5', '0', '5');
    expect(worldService.getTilesInBounds).toHaveBeenCalledWith(0, 5, 0, 5);
    expect(tiles).toHaveLength(1);

    await expect(
      controller.getTilesInBounds('5', '0', '0', '5'),
    ).rejects.toThrow(BadRequestException);
  });
});
