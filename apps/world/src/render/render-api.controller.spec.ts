import { RenderApiController } from './render-api.controller';
import { RenderService } from './render.service';
import { CacheService } from '../shared/cache.service';

type RenderServiceMock = Pick<
  RenderService,
  'prepareMapData' | 'renderMapAscii' | 'renderMap'
>;

type CacheServiceMock = Pick<CacheService, 'get' | 'set'>;

describe('RenderApiController', () => {
  let controller: RenderApiController;
  let renderService: jest.Mocked<RenderServiceMock>;
  let cacheService: jest.Mocked<CacheServiceMock>;

  const mockCanvas = {
    toBuffer: jest.fn(() => Buffer.from('png-data')),
  } as unknown as ReturnType<RenderService['renderMap']> extends Promise<infer R>
    ? R
    : never;

  beforeEach(() => {
    renderService = {
      prepareMapData: jest.fn(),
      renderMapAscii: jest.fn(),
      renderMap: jest.fn(),
    } as unknown as jest.Mocked<RenderServiceMock>;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<CacheServiceMock>;

    controller = new RenderApiController(renderService, cacheService);

    renderService.prepareMapData.mockResolvedValue({
      tileData: [
        {
          x: -25,
          y: -25,
          biome: { name: 'Forest', ascii: 'F' },
          settlement: null,
          tile: null,
          hasError: false,
        },
      ],
      width: 50,
      height: 50,
      settlementMap: new Map(),
      existingTileCount: 1,
    });

    renderService.renderMapAscii.mockResolvedValue('ASCII');
    renderService.renderMap.mockResolvedValue(mockCanvas);
  });

  it('returns a 50x50 grid for map tiles', async () => {
    const response = await (controller as unknown as {
      handleRenderMapTiles: (x?: number, y?: number) => Promise<any>;
    }).handleRenderMapTiles();

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(50);
    expect(response.body[0]).toHaveLength(50);
    expect(renderService.prepareMapData).toHaveBeenCalledWith(-25, 25, -25, 25);
  });

  it('passes coordinates through to renderMapAscii', async () => {
    const response = await (controller as unknown as {
      handleRenderMapAscii: (x?: number, y?: number) => Promise<any>;
    }).handleRenderMapAscii(10, -10);

    expect(response.status).toBe(200);
    expect(response.body.ascii).toBe('ASCII');
    expect(renderService.renderMapAscii).toHaveBeenCalledWith(-15, 35, -35, 15);
  });

  it('returns cached PNG base64 when available', async () => {
    cacheService.get.mockResolvedValue('cached-base64');

    const response = await (controller as unknown as {
      handleRenderMapPngBase64: (
        x?: number,
        y?: number,
        pixelsPerTile?: number,
      ) => Promise<any>;
    }).handleRenderMapPngBase64(0, 0, 4);

    expect(response.body.imageBase64).toBe('cached-base64');
    expect(renderService.renderMap).not.toHaveBeenCalled();
  });

  it('renders PNG and caches when not present', async () => {
    cacheService.get.mockResolvedValue(null);

    cacheService.get.mockResolvedValue(null);

    const response = await (controller as unknown as {
      handleRenderMapPngBase64: (
        x?: number,
        y?: number,
        pixelsPerTile?: number,
      ) => Promise<any>;
    }).handleRenderMapPngBase64();

    expect(response.body.imageBase64).toBe(Buffer.from('png-data').toString('base64'));
    expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
    expect(cacheService.set).toHaveBeenCalled();
  });
});
