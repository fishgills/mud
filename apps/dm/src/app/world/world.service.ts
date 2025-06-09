import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { WorldTile } from '@prisma/client';
import axios from 'axios';

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

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private readonly worldServiceUrl =
    process.env.WORLD_SERVICE_URL || 'http://localhost:3001/api';

  /**
   * Generic HTTP client wrapper with error handling
   */
  private async makeRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: Record<string, unknown>,
    options: {
      logErrorMessage?: string;
      throwOnError?: boolean;
      defaultValue?: T;
    } = {}
  ): Promise<T | null> {
    const {
      logErrorMessage,
      throwOnError = false,
      defaultValue = null,
    } = options;

    this.logger.log(`Making ${method.toUpperCase()} request to ${url}`);
    try {
      const response = await axios[method](url, data);
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (logErrorMessage) {
        this.logger.error(logErrorMessage, errorMessage);
      }

      if (throwOnError) {
        throw new HttpException(
          'World service unavailable',
          HttpStatus.SERVICE_UNAVAILABLE
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
      description: 'A rolling grassland with scattered trees.',
      height: 0.5,
      temperature: 0.6,
      moisture: 0.5,
      seed: 12345,
      chunkX: Math.floor(x / 16),
      chunkY: Math.floor(y / 16),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.makeRequest<WorldTile>(
      'get',
      `${this.worldServiceUrl}world/tile/${x}/${y}`,
      undefined,
      {
        logErrorMessage: `Failed to fetch tile info for (${x}, ${y}):`,
        defaultValue: defaultTile,
      }
    );

    return result || defaultTile;
  }

  async getChunk(chunkX: number, chunkY: number): Promise<WorldTile[]> {
    const result = await this.makeRequest<WorldTile[]>(
      'get',
      `${this.worldServiceUrl}/chunk/${chunkX}/${chunkY}`,
      undefined,
      {
        logErrorMessage: `Failed to fetch chunk (${chunkX}, ${chunkY}):`,
        throwOnError: true,
      }
    );

    return result || [];
  }

  async getSurroundingTiles(
    x: number,
    y: number,
    radius = 1
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

  async updateTileDescription(
    x: number,
    y: number,
    description: string
  ): Promise<boolean> {
    const result = await this.makeRequest<{ status: number }>(
      'put',
      `${this.worldServiceUrl}world/tile/${x}/${y}/description`,
      { description },
      {
        logErrorMessage: `Failed to update tile description for (${x}, ${y}):`,
      }
    );

    return result !== null;
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.makeRequest<{ status: number }>(
      'get',
      `${this.worldServiceUrl}/health`,
      undefined,
      {
        // No logging for health check failures to avoid spam
      }
    );

    return result !== null;
  }
}
