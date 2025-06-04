import axios from 'axios';

const WORLD_SERVICE_URL = process.env.WORLD_SERVICE_URL || 'http://localhost:3001';

export interface WorldTile {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  description: string;
}

export class WorldServiceClient {
  private baseURL: string;

  constructor(baseURL = WORLD_SERVICE_URL) {
    this.baseURL = baseURL;
  }

  async getTile(x: number, y: number): Promise<WorldTile> {
    try {
      const response = await axios.get(`${this.baseURL}/world/tile/${x}/${y}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching tile (${x}, ${y}):`, error);
      throw new Error(`Failed to fetch tile at (${x}, ${y})`);
    }
  }

  async generateGrid(centerX: number, centerY: number, radius = 5): Promise<WorldTile[]> {
    try {
      const response = await axios.post(`${this.baseURL}/world/grid`, {
        centerX,
        centerY,
        radius
      });
      return response.data.tiles;
    } catch (error) {
      console.error(`Error generating grid around (${centerX}, ${centerY}):`, error);
      throw new Error(`Failed to generate grid around (${centerX}, ${centerY})`);
    }
  }

  async seedWorld(): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/world/seed`);
    } catch (error) {
      console.error('Error seeding world:', error);
      throw new Error('Failed to seed world');
    }
  }

  async resetWorld(): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/world/reset`);
    } catch (error) {
      console.error('Error resetting world:', error);
      throw new Error('Failed to reset world');
    }
  }
}

export const worldService = new WorldServiceClient();
