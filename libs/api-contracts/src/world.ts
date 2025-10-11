import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const biomeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const worldTileSchema = z.object({
  id: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  biomeId: z.number().int(),
  biomeName: z.string(),
  description: z.string().nullable().optional(),
  height: z.number(),
  temperature: z.number(),
  moisture: z.number(),
  seed: z.number().int(),
  chunkX: z.number().int(),
  chunkY: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  biome: biomeSchema.optional(),
});

export const nearbyBiomeSchema = z.object({
  biomeName: z.string(),
  distance: z.number(),
  direction: z.string(),
});

export const nearbySettlementSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.string(),
  population: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  description: z.string(),
  distance: z.number(),
});

export const currentSettlementSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.string(),
  intensity: z.number(),
  isCenter: z.boolean(),
});

export const tileWithNearbySchema = worldTileSchema.extend({
  nearbyBiomes: z.array(nearbyBiomeSchema),
  nearbySettlements: z.array(nearbySettlementSchema),
  currentSettlement: currentSettlementSchema.optional(),
});

export const chunkStatsSchema = z.object({
  averageHeight: z.number(),
  averageTemperature: z.number(),
  averageMoisture: z.number(),
});

export const biomeCountSchema = z.object({
  biomeName: z.string(),
  count: z.number().int(),
});

export const settlementSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  size: z.string(),
  population: z.number().int(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paginatedTilesSchema = z.object({
  tiles: z.array(worldTileSchema),
  totalCount: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
  hasMore: z.boolean(),
});

export const chunkDataSchema = z.object({
  chunkX: z.number().int(),
  chunkY: z.number().int(),
  tiles: z.array(worldTileSchema).optional(),
  paginatedTiles: paginatedTilesSchema.optional(),
  settlements: z.array(settlementSchema).optional(),
  stats: chunkStatsSchema.optional(),
  biomeStats: z.array(biomeCountSchema).optional(),
});

export const mapTileSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  biomeName: z.string().optional(),
  symbol: z.string().optional(),
  hasSettlement: z.boolean(),
  isSettlementCenter: z.boolean(),
});

export const worldHealthSchema = z.object({
  status: z.literal('healthy'),
  timestamp: z.string(),
});

const getChunkQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeSettlements: z.coerce.boolean().optional().default(true),
  includeStats: z.coerce.boolean().optional().default(true),
  includeBiomeStats: z.coerce.boolean().optional().default(true),
});

const boundsQuerySchema = z.object({
  minX: z.coerce.number(),
  maxX: z.coerce.number(),
  minY: z.coerce.number(),
  maxY: z.coerce.number(),
});

const renderQueryBase = z.object({
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
});

const renderPngQuerySchema = renderQueryBase.extend({
  pixelsPerTile: z.coerce.number().int().min(1).max(16).optional(),
});

const c = initContract();

export const worldContract = c.router({
  health: {
    method: 'GET',
    path: '/health',
    responses: {
      200: worldHealthSchema,
    },
    summary: 'Health check for the world service.',
  },
  getTile: {
    method: 'GET',
    path: '/tiles/:x/:y',
    pathParams: z.object({
      x: z.coerce.number().int(),
      y: z.coerce.number().int(),
    }),
    responses: {
      200: tileWithNearbySchema,
    },
    summary: 'Fetch a tile with nearby biome and settlement information.',
  },
  getChunk: {
    method: 'GET',
    path: '/chunks/:chunkX/:chunkY',
    pathParams: z.object({
      chunkX: z.coerce.number().int(),
      chunkY: z.coerce.number().int(),
    }),
    query: getChunkQuerySchema,
    responses: {
      200: chunkDataSchema,
    },
    summary: 'Fetch chunk data including tiles, stats, and settlements.',
  },
  getTilesInBounds: {
    method: 'GET',
    path: '/tiles',
    query: boundsQuerySchema,
    responses: {
      200: z.array(worldTileSchema),
    },
    summary:
      'Fetch tiles within provided rectangular bounds (inclusive coordinates).',
  },
  renderMapTiles: {
    method: 'GET',
    path: '/render/map-tiles',
    query: renderQueryBase,
    responses: {
      200: z.array(z.array(mapTileSchema)),
    },
    summary:
      'Render a 2D grid of map tiles (50x50 region) centered on the provided coordinates.',
  },
  renderMapAscii: {
    method: 'GET',
    path: '/render/map-ascii',
    query: renderQueryBase,
    responses: {
      200: z.object({
        ascii: z.string(),
      }),
    },
    summary:
      'Render the ASCII representation of the map for a 50x50 region centered on the provided coordinates.',
  },
  renderMapPngBase64: {
    method: 'GET',
    path: '/render/map-png-base64',
    query: renderPngQuerySchema,
    responses: {
      200: z.object({
        imageBase64: z.string(),
      }),
    },
    summary:
      'Render the map as a PNG image (base64 encoded) for a 50x50 region centered on the provided coordinates.',
  },
});

export type WorldContract = typeof worldContract;
export type WorldTile = z.infer<typeof worldTileSchema>;
export type NearbyBiome = z.infer<typeof nearbyBiomeSchema>;
export type NearbySettlement = z.infer<typeof nearbySettlementSchema>;
export type CurrentSettlement = z.infer<typeof currentSettlementSchema>;
export type TileWithNearby = z.infer<typeof tileWithNearbySchema>;
export type ChunkData = z.infer<typeof chunkDataSchema>;
export type PaginatedTiles = z.infer<typeof paginatedTilesSchema>;
export type ChunkStats = z.infer<typeof chunkStatsSchema>;
export type BiomeCount = z.infer<typeof biomeCountSchema>;
export type Settlement = z.infer<typeof settlementSchema>;
export type MapTile = z.infer<typeof mapTileSchema>;
export type WorldHealth = z.infer<typeof worldHealthSchema>;
export type Biome = z.infer<typeof biomeSchema>;
