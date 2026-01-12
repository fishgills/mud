// Mock env module before other imports
jest.mock('../env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    CACHE_PREFIX: 'test:',
    WORLD_RENDER_CACHE_TTL_MS: 30000,
    WORLD_RENDER_COMPUTE_ON_THE_FLY: true,
  },
}));

jest.mock('./image-utils', () => ({
  bitmapToPngBase64: jest
    .fn()
    .mockResolvedValue(Buffer.from('fake-png-data').toString('base64')),
}));

import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { CacheService } from '../shared/cache.service';
import { Response } from 'express';
import { bitmapToPngBase64 } from './image-utils';

const bitmapToPngBase64Mock = bitmapToPngBase64 as jest.MockedFunction<
  typeof bitmapToPngBase64
>;

describe('RenderController', () => {
  let controller: RenderController;
  let renderService: jest.Mocked<RenderService>;
  let cacheService: jest.Mocked<CacheService>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    const mockCanvas = {};

    renderService = {
      renderMap: jest.fn().mockResolvedValue(mockCanvas),
      getRenderStyleVersion: jest.fn().mockReturnValue(8),
    } as unknown as jest.Mocked<RenderService>;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    bitmapToPngBase64Mock.mockClear();
    bitmapToPngBase64Mock.mockResolvedValue(
      Buffer.from('fake-png-data').toString('base64'),
    );

    controller = new RenderController(renderService, cacheService);
  });

  describe('getMapPng', () => {
    const callController = (
      controllerRef: RenderController,
      response: Response,
      x?: string,
      y?: string,
      p?: string,
    ) => controllerRef.getMapPng(response, x, y, p);

    it('should render map with default parameters', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response);

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 4);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/png',
      );
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should use provided x and y coordinates', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response, '100', '200');

      expect(renderService.renderMap).toHaveBeenCalledWith(
        70,
        130,
        170,
        230,
        4,
      );
    });

    it('should use provided pixels per tile', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        undefined,
        undefined,
        '8',
      );

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 8);
    });

    it('should enforce minimum pixels per tile of 1', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        undefined,
        undefined,
        '0',
      );

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 1);
    });

    it('should enforce minimum pixels per tile for negative values', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        undefined,
        undefined,
        '-5',
      );

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 1);
    });

    it('should return cached image when available', async () => {
      const cachedBase64 = Buffer.from('cached-png-data').toString('base64');
      cacheService.get.mockResolvedValue(cachedBase64);

      await callController(controller, mockResponse as Response);

      expect(renderService.renderMap).not.toHaveBeenCalled();
      expect(mockResponse.send).toHaveBeenCalledWith(
        Buffer.from(cachedBase64, 'base64'),
      );
    });

    it('should set cache control headers', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('public'),
      );
    });

    it('should cache rendered image', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should handle non-numeric x coordinate', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response, 'invalid');

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 4);
    });

    it('should handle non-numeric y coordinate', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        undefined,
        'invalid',
      );

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 4);
    });

    it('should handle non-numeric pixels per tile', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        undefined,
        undefined,
        'invalid',
      );

      expect(renderService.renderMap).toHaveBeenCalledWith(-30, 30, -30, 30, 4);
    });

    it('should use correct cache key format', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        '10',
        '20',
        '8',
      );

      const expectedKey = 'map:png:v8:-20,-10,40,50,p=8,view=ortho';
      expect(cacheService.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should use default TTL when env var not set', async () => {
      delete process.env.WORLD_RENDER_CACHE_TTL_MS;
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        30000,
      );
    });

    it('should calculate correct bounds for positive coordinates', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response, '50', '100');

      expect(renderService.renderMap).toHaveBeenCalledWith(20, 80, 70, 130, 4);
    });

    it('should calculate correct bounds for negative coordinates', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response, '-50', '-100');

      expect(renderService.renderMap).toHaveBeenCalledWith(
        -80,
        -20,
        -130,
        -70,
        4,
      );
    });
  });
});
