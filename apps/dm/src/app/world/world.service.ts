import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
  private readonly worldServiceUrl =
    process.env.WORLD_SERVICE_URL || 'http://localhost:3001/api';

  async getTileInfo(x: number, y: number): Promise<WorldTile> {
    try {
      const response = await axios.get<WorldTile>(
        `${this.worldServiceUrl}world/tile/${x}/${y}`
      );
      return response.data;
    } catch (error) {
      console.error(
        `Failed to fetch tile info for (${x}, ${y}):`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      // Return a default tile if the world service is unavailable
      return {
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
    }
  }

  async getChunk(chunkX: number, chunkY: number): Promise<WorldTile[]> {
    try {
      const response = await axios.get(
        `${this.worldServiceUrl}/chunk/${chunkX}/${chunkY}`
      );
      return response.data;
    } catch (error) {
      console.error(
        `Failed to fetch chunk (${chunkX}, ${chunkY}):`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new HttpException(
        'World service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getSurroundingTiles(
    x: number,
    y: number,
    radius = 1
  ): Promise<WorldTile[]> {
    const surroundingTiles: WorldTile[] = [];

    try {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Skip the center tile (current player position)
          if (dx === 0 && dy === 0) continue;

          try {
            const tile = await this.getTileInfo(x + dx, y + dy);
            surroundingTiles.push(tile);
          } catch (error) {
            // If a tile fails to load, continue with others
            console.warn(
              `Failed to load tile at (${x + dx}, ${y + dy}):`,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to get surrounding tiles for (${x}, ${y}):`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    return surroundingTiles;
  }

  async updateTileDescription(
    x: number,
    y: number,
    description: string
  ): Promise<boolean> {
    try {
      const response = await axios.put(
        `${this.worldServiceUrl}/tile/${x}/${y}/description`,
        { description }
      );
      return response.status === 200;
    } catch (error) {
      console.error(
        `Failed to update tile description for (${x}, ${y}):`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.worldServiceUrl}/health`);
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
