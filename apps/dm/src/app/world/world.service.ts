import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface WorldTileInfo {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  biomeName: string;
  description: string;
  height: number;
  temperature: number;
  moisture: number;
}

@Injectable()
export class WorldService {
  private readonly worldServiceUrl =
    process.env.WORLD_SERVICE_URL || 'http://localhost:3001/api';

  async getTileInfo(x: number, y: number): Promise<WorldTileInfo> {
    try {
      const response = await axios.get(
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
      };
    }
  }

  async getChunk(chunkX: number, chunkY: number): Promise<WorldTileInfo[]> {
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

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.worldServiceUrl}/health`);
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
