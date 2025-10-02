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

import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { CacheService } from '../shared/cache.service';
import { Response } from 'express';

describe('RenderController', () => {
  let controller: RenderController;
  let renderService: jest.Mocked<RenderService>;
  let cacheService: jest.Mocked<CacheService>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    const mockCanvas = {
      toBuffer: jest.fn().mockReturnValue(Buffer.from('fake-png-data')),
    };

    renderService = {
      renderMap: jest.fn().mockResolvedValue(mockCanvas),
    } as unknown as jest.Mocked<RenderService>;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

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

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
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
        75,
        125,
        175,
        225,
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

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 8);
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

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 1);
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

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 1);
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

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
    });

    it('should handle non-numeric y coordinate', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(
        controller,
        mockResponse as Response,
        undefined,
        'invalid',
      );

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
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

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
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

      const expectedKey = '-15,-5,35,45,p=8';
      expect(cacheService.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should use WORLD_RENDER_CACHE_TTL_MS from env', async () => {
      process.env.WORLD_RENDER_CACHE_TTL_MS = '60000';
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        60000,
      );

      delete process.env.WORLD_RENDER_CACHE_TTL_MS;
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

      expect(renderService.renderMap).toHaveBeenCalledWith(25, 75, 75, 125, 4);
    });

    it('should calculate correct bounds for negative coordinates', async () => {
      cacheService.get.mockResolvedValue(null);

      await callController(controller, mockResponse as Response, '-50', '-100');

      expect(renderService.renderMap).toHaveBeenCalledWith(
        -75,
        -25,
        -125,
        -75,
        4,
      );
    });
  });
});
