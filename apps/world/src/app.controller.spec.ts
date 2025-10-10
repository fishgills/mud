import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TileService } from './world/tile.service';
import { RpcException } from '@nestjs/microservices';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;
  let tileService: TileService;

  beforeEach(() => {
    // Mock the dependencies
    appService = new AppService();
    tileService = {
      getTile: jest.fn(),
    } as any;

    appController = new AppController(appService, tileService);
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('GenerateTile', () => {
    it('should return a tile when found', async () => {
      const mockTile = {
        description: 'A grassy field',
        biomeName: 'grassland',
      };
      (tileService.getTile as jest.Mock).mockResolvedValue(mockTile);

      const request = { x: 1, y: 2 };
      const response = await appController.GenerateTile(request);

      expect(tileService.getTile).toHaveBeenCalledWith(1, 2);
      expect(response.tile).toEqual({
        description: 'A grassy field',
        biome: 'grassland',
      });
    });

    it('should throw an RpcException when tile is not found', async () => {
      (tileService.getTile as jest.Mock).mockResolvedValue(null);

      const request = { x: 1, y: 2 };

      await expect(appController.GenerateTile(request)).rejects.toThrow(
        new RpcException(`Tile not found at 1,2`),
      );
    });
  });
});