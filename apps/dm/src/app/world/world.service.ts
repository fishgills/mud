import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { WorldTile } from '@prisma/client';
import { GraphQLClient, gql } from 'graphql-request';

export interface Biome {
  id: number;
  name: string;
}

export interface NearbyBiome {
  biomeName: string;
  distance: number;
  direction: string;
}

export interface NearbySettlement {
  name: string;
  type: string;
  size: string;
  population: number;
  x: number;
  y: number;
  description: string;
  distance: number;
}

export interface Settlement {
  name: string;
  type: string;
  size: string;
  intensity: number;
  isCenter: boolean;
}

// GraphQL response types that match the World service schema
interface TileWithNearbyBiomes {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  biomeName: string;
  description?: string;
  height: number;
  temperature: number;
  moisture: number;
  seed: number;
  chunkX: number;
  chunkY: number;
  createdAt: string;
  updatedAt: string;
  nearbyBiomes: NearbyBiome[];
  nearbySettlements: NearbySettlement[];
  currentSettlement?: Settlement;
}

interface ChunkData {
  chunkX: number;
  chunkY: number;
  tiles: WorldTile[];
}

interface TileUpdateResult {
  success: boolean;
  message: string;
}

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private readonly worldServiceUrl =
    process.env.WORLD_SERVICE_URL || 'http://localhost:3000';
  private readonly graphqlClient: GraphQLClient;
  // Simple in-memory cache and in-flight dedupe for chunk requests
  private readonly chunkCache = new Map<
    string,
    { tiles: WorldTile[]; ts: number }
  >();
  private readonly inflightChunkRequests = new Map<
    string,
    Promise<WorldTile[]>
  >();
  private readonly CHUNK_CACHE_TTL_MS = Number.parseInt(
    process.env.DM_CHUNK_CACHE_TTL_MS || '10000',
    10,
  );
  // Center-with-nearby cache and inflight dedupe
  private readonly centerNearbyCache = new Map<
    string,
    {
      data: {
        tile: WorldTile;
        nearbyBiomes: NearbyBiome[];
        nearbySettlements: NearbySettlement[];
        currentSettlement?: Settlement;
      };
      ts: number;
    }
  >();
  private readonly inflightCenterNearby = new Map<
    string,
    Promise<{
      tile: WorldTile;
      nearbyBiomes: NearbyBiome[];
      nearbySettlements: NearbySettlement[];
      currentSettlement?: Settlement;
    }>
  >();
  private readonly CENTER_NEARBY_CACHE_TTL_MS = Number.parseInt(
    process.env.DM_CENTER_NEARBY_CACHE_TTL_MS || '15000',
    10,
  );

  constructor() {
    // Ensure URL doesn't have double slashes
    const baseUrl = this.worldServiceUrl.endsWith('/')
      ? this.worldServiceUrl.slice(0, -1)
      : this.worldServiceUrl;
    const graphqlUrl = `${baseUrl}/graphql`;

    this.logger.log(`Initializing GraphQL client with URL: ${graphqlUrl}`);
    this.graphqlClient = new GraphQLClient(graphqlUrl);
  }

  /**
   * Generic GraphQL request wrapper with error handling
   */
  private async makeGraphQLRequest<T>(
    query: string,
    variables?: Record<string, unknown>,
    options: {
      logErrorMessage?: string;
      throwOnError?: boolean;
      defaultValue?: T;
    } = {},
  ): Promise<T | null> {
    const {
      logErrorMessage,
      throwOnError = false,
      defaultValue = null,
    } = options;

    try {
      const response = await this.graphqlClient.request<T>(query, variables);
      this.logger.log(
        `GraphQL request successful: ${JSON.stringify(response).substring(0, 200)}...`,
      );
      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`GraphQL request failed to ${this.worldServiceUrl}`);
      this.logger.error(`Query: ${query}`);
      this.logger.error(`Variables: ${JSON.stringify(variables)}`);
      this.logger.error(`Error: ${errorMessage}`);

      if (logErrorMessage) {
        this.logger.error(logErrorMessage, errorMessage);
      }

      if (throwOnError) {
        throw new HttpException(
          'World service unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return defaultValue as T;
    }
  }

  async getTileInfo(x: number, y: number): Promise<WorldTile> {
    const defaultTile: WorldTile = {
      id: 0,
      x,
      y,
      biomeId: 1,
      biomeName: 'grassland',
      description: '',
      height: 0.5,
      temperature: 0.6,
      moisture: 0.5,
      seed: 12345,
      chunkX: Math.floor(x / 16),
      chunkY: Math.floor(y / 16),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const GET_TILE_QUERY = gql`
      query GetTile($x: Int!, $y: Int!) {
        getTile(x: $x, y: $y) {
          id
          x
          y
          biomeId
          biomeName
          description
          height
          temperature
          moisture
          seed
          chunkX
          chunkY
          createdAt
          updatedAt
        }
      }
    `;

    const result = await this.makeGraphQLRequest<{
      getTile: TileWithNearbyBiomes;
    }>(
      GET_TILE_QUERY,
      { x, y },
      {
        logErrorMessage: `Failed to fetch tile info for (${x}, ${y}):`,
        defaultValue: { getTile: defaultTile as any },
      },
    );

    if (result?.getTile) {
      // Convert the GraphQL response to the expected WorldTile format
      const tile = result.getTile;
      return {
        id: tile.id,
        x: tile.x,
        y: tile.y,
        biomeId: tile.biomeId,
        biomeName: tile.biomeName,
        description: tile.description || defaultTile.description,
        height: tile.height,
        temperature: tile.temperature,
        moisture: tile.moisture,
        seed: tile.seed,
        chunkX: tile.chunkX,
        chunkY: tile.chunkY,
        createdAt: new Date(tile.createdAt),
        updatedAt: new Date(tile.updatedAt),
      };
    }

    return defaultTile;
  }

  async getChunk(chunkX: number, chunkY: number): Promise<WorldTile[]> {
    const key = `${chunkX}:${chunkY}`;

    // Serve from cache if fresh
    const cached = this.chunkCache.get(key);
    if (cached && Date.now() - cached.ts < this.CHUNK_CACHE_TTL_MS) {
      return cached.tiles;
    }

    // Deduplicate concurrent requests for the same chunk
    const inflight = this.inflightChunkRequests.get(key);
    if (inflight) return inflight;

    const GET_CHUNK_QUERY = gql`
      query GetChunk($chunkX: Float!, $chunkY: Float!) {
        getChunk(chunkX: $chunkX, chunkY: $chunkY) {
          chunkX
          chunkY
          tiles {
            id
            x
            y
            biomeId
            biomeName
            description
            height
            temperature
            moisture
            seed
            chunkX
            chunkY
            createdAt
            updatedAt
          }
        }
      }
    `;

    const promise = (async () => {
      const result = await this.makeGraphQLRequest<{ getChunk: ChunkData }>(
        GET_CHUNK_QUERY,
        { chunkX, chunkY },
        {
          logErrorMessage: `Failed to fetch chunk (${chunkX}, ${chunkY}):`,
          throwOnError: true,
        },
      );

      let tiles: WorldTile[] = [];
      if (result?.getChunk?.tiles) {
        // Convert GraphQL response to WorldTile format
        tiles = result.getChunk.tiles.map((tile) => ({
          id: tile.id,
          x: tile.x,
          y: tile.y,
          biomeId: tile.biomeId,
          biomeName: tile.biomeName,
          description: tile.description || '',
          height: tile.height,
          temperature: tile.temperature,
          moisture: tile.moisture,
          seed: tile.seed,
          chunkX: tile.chunkX,
          chunkY: tile.chunkY,
          createdAt: new Date(tile.createdAt),
          updatedAt: new Date(tile.updatedAt),
        }));
      }

      // cache the result (even empty) to avoid hammering
      this.chunkCache.set(key, { tiles, ts: Date.now() });
      return tiles;
    })().finally(() => {
      // clear inflight regardless of success/failure
      this.inflightChunkRequests.delete(key);
    });

    this.inflightChunkRequests.set(key, promise);
    return promise;
  }

  async getSurroundingTiles(
    x: number,
    y: number,
    radius = 1,
  ): Promise<WorldTile[]> {
    const tilePromises: Promise<WorldTile>[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Skip the center tile (current player position)
        if (dx === 0 && dy === 0) continue;

        tilePromises.push(this.getTileInfo(x + dx, y + dy));
      }
    }

    return Promise.all(tilePromises);
  }

  /** Fetch all tiles in [minX,maxX] x [minY,maxY] by combining overlapping chunks */
  async getTilesInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    chunkSize = 50,
  ): Promise<WorldTile[]> {
    const minChunkX = Math.floor(minX / chunkSize);
    const maxChunkX = Math.floor(maxX / chunkSize);
    const minChunkY = Math.floor(minY / chunkSize);
    const maxChunkY = Math.floor(maxY / chunkSize);

    // Build list of unique chunk coords within the bounds
    const coords: Array<[number, number]> = [];
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        coords.push([cx, cy]);
      }
    }

    // Fetch all chunks in parallel (benefits from in-flight deduping & cache)
    const chunks = await Promise.all(
      coords.map(([cx, cy]) => this.getChunk(cx, cy)),
    );

    // Flatten and filter tiles by bounds
    const tiles = chunks
      .flat()
      .filter((t) => t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY);

    return tiles;
  }

  async updateTileDescription(
    x: number,
    y: number,
    description: string,
  ): Promise<boolean> {
    const UPDATE_TILE_MUTATION = gql`
      mutation UpdateTileDescription(
        $x: Int!
        $y: Int!
        $description: String!
      ) {
        updateTileDescription(x: $x, y: $y, description: $description) {
          success
          message
        }
      }
    `;

    const result = await this.makeGraphQLRequest<{
      updateTileDescription: TileUpdateResult;
    }>(
      UPDATE_TILE_MUTATION,
      { x, y, description },
      {
        logErrorMessage: `Failed to update tile description for (${x}, ${y}):`,
      },
    );

    return result?.updateTileDescription?.success || false;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Use a simple introspection query to check if the GraphQL service is available
      const HEALTH_CHECK_QUERY = gql`
        query HealthCheck {
          __schema {
            queryType {
              name
            }
          }
        }
      `;

      const result = await this.makeGraphQLRequest<any>(
        HEALTH_CHECK_QUERY,
        {},
        {
          // No logging for health check failures to avoid spam
        },
      );

      return result !== null;
    } catch {
      return false;
    }
  }

  async getTileInfoWithNearby(
    x: number,
    y: number,
  ): Promise<{
    tile: WorldTile;
    nearbyBiomes: NearbyBiome[];
    nearbySettlements: NearbySettlement[];
    currentSettlement?: Settlement;
  }> {
    const cacheKey = `${x}:${y}`;
    const cached = this.centerNearbyCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CENTER_NEARBY_CACHE_TTL_MS) {
      return cached.data;
    }

    const inflight = this.inflightCenterNearby.get(cacheKey);
    if (inflight) return inflight;

    const GET_TILE_WITH_NEARBY_QUERY = gql`
      query GetTileWithNearby($x: Int!, $y: Int!) {
        getTile(x: $x, y: $y) {
          id
          x
          y
          biomeId
          biomeName
          description
          height
          temperature
          moisture
          seed
          chunkX
          chunkY
          createdAt
          updatedAt
          nearbyBiomes {
            biomeName
            distance
            direction
          }
          nearbySettlements {
            name
            type
            size
            population
            x
            y
            description
            distance
          }
          currentSettlement {
            name
            type
            size
            intensity
            isCenter
          }
        }
      }
    `;

    const defaultTile: WorldTile = {
      id: 0,
      x,
      y,
      biomeId: 1,
      biomeName: 'grassland',
      description: '',
      height: 0.5,
      temperature: 0.6,
      moisture: 0.5,
      seed: 12345,
      chunkX: Math.floor(x / 16),
      chunkY: Math.floor(y / 16),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promise = (async () => {
      const result = await this.makeGraphQLRequest<{
        getTile: TileWithNearbyBiomes;
      }>(
        GET_TILE_WITH_NEARBY_QUERY,
        { x, y },
        {
          logErrorMessage: `Failed to fetch tile with nearby data for (${x}, ${y}):`,
          defaultValue: {
            getTile: {
              ...defaultTile,
              nearbyBiomes: [],
              nearbySettlements: [],
            } as any,
          },
        },
      );

      let data: {
        tile: WorldTile;
        nearbyBiomes: NearbyBiome[];
        nearbySettlements: NearbySettlement[];
        currentSettlement?: Settlement;
      } = {
        tile: defaultTile,
        nearbyBiomes: [],
        nearbySettlements: [],
      };

      if (result?.getTile) {
        const tile = result.getTile;
        data = {
          tile: {
            id: tile.id,
            x: tile.x,
            y: tile.y,
            biomeId: tile.biomeId,
            biomeName: tile.biomeName,
            description: tile.description || defaultTile.description,
            height: tile.height,
            temperature: tile.temperature,
            moisture: tile.moisture,
            seed: tile.seed,
            chunkX: tile.chunkX,
            chunkY: tile.chunkY,
            createdAt: new Date(tile.createdAt),
            updatedAt: new Date(tile.updatedAt),
          },
          nearbyBiomes: tile.nearbyBiomes || [],
          nearbySettlements: tile.nearbySettlements || [],
          currentSettlement: tile.currentSettlement,
        };
      }

      this.centerNearbyCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    })().finally(() => this.inflightCenterNearby.delete(cacheKey));

    this.inflightCenterNearby.set(cacheKey, promise);
    return promise;
  }
}
