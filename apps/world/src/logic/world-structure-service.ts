import { SettlementGenerator, RegionInfo } from './settlement-generator';
import {
  Settlement,
  Landmark,
  SettlementType,
  SettlementSize,
  LandmarkType,
} from './settlement-definitions';
import prisma from '../prisma';

/**
 * Service for managing settlements and landmarks in the world
 */
export class WorldStructureService {
  private settlementGenerator: SettlementGenerator;
  private generatedRegions: Set<string> = new Set();

  constructor() {
    this.settlementGenerator = new SettlementGenerator();
  }

  /**
   * Generate settlements and landmarks for a region if not already done
   */
  async generateRegionStructures(region: RegionInfo): Promise<{
    settlements: Settlement[];
    landmarks: Landmark[];
  }> {
    const regionKey = `${region.centerX}-${region.centerY}-${region.width}-${region.height}`;

    if (this.generatedRegions.has(regionKey)) {
      // Return existing structures from database
      return await this.getRegionStructures(region);
    }

    // Generate new settlements and landmarks
    const settlements = this.settlementGenerator.generateSettlements(region);
    const landmarks = this.settlementGenerator.generateLandmarks(
      region,
      settlements
    );

    // Store them in the database
    await this.storeSettlements(settlements);
    await this.storeLandmarks(landmarks);

    this.generatedRegions.add(regionKey);

    return { settlements, landmarks };
  }

  /**
   * Get existing settlements and landmarks for a region
   */
  async getRegionStructures(region: RegionInfo): Promise<{
    settlements: Settlement[];
    landmarks: Landmark[];
  }> {
    const minX = region.centerX - region.width / 2;
    const maxX = region.centerX + region.width / 2;
    const minY = region.centerY - region.height / 2;
    const maxY = region.centerY + region.height / 2;

    const [settlements, landmarks] = await Promise.all([
      prisma.settlement.findMany({
        where: {
          x: { gte: minX, lte: maxX },
          y: { gte: minY, lte: maxY },
        },
      }),
      prisma.landmark.findMany({
        where: {
          x: { gte: minX, lte: maxX },
          y: { gte: minY, lte: maxY },
        },
      }),
    ]);

    return {
      settlements: settlements.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as SettlementType,
        x: s.x,
        y: s.y,
        size: s.size as SettlementSize,
        population: s.population,
        description: s.description,
      })),
      landmarks: landmarks.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type as LandmarkType,
        x: l.x,
        y: l.y,
        description: l.description,
      })),
    };
  }

  /**
   * Get settlement at specific coordinates
   */
  async getSettlementAt(x: number, y: number): Promise<Settlement | null> {
    const settlement = await prisma.settlement.findUnique({
      where: { x_y: { x, y } },
    });

    if (!settlement) return null;

    return {
      id: settlement.id,
      name: settlement.name,
      type: settlement.type as SettlementType,
      x: settlement.x,
      y: settlement.y,
      size: settlement.size as SettlementSize,
      population: settlement.population,
      description: settlement.description,
    };
  }

  /**
   * Get landmark at specific coordinates
   */
  async getLandmarkAt(x: number, y: number): Promise<Landmark | null> {
    const landmark = await prisma.landmark.findUnique({
      where: { x_y: { x, y } },
    });

    if (!landmark) return null;

    return {
      id: landmark.id,
      name: landmark.name,
      type: landmark.type as LandmarkType,
      x: landmark.x,
      y: landmark.y,
      description: landmark.description,
    };
  }

  /**
   * Check if there's any structure (settlement or landmark) at coordinates
   */
  async getStructureAt(
    x: number,
    y: number
  ): Promise<Settlement | Landmark | null> {
    const [settlement, landmark] = await Promise.all([
      this.getSettlementAt(x, y),
      this.getLandmarkAt(x, y),
    ]);

    return settlement || landmark;
  }

  private async storeSettlements(settlements: Settlement[]): Promise<void> {
    if (settlements.length === 0) return;

    try {
      await prisma.settlement.createMany({
        data: settlements.map((s) => ({
          name: s.name,
          type: s.type,
          x: s.x,
          y: s.y,
          size: s.size,
          population: s.population,
          description: s.description,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      console.error('Error storing settlements:', error);
    }
  }

  private async storeLandmarks(landmarks: Landmark[]): Promise<void> {
    if (landmarks.length === 0) return;

    try {
      await prisma.landmark.createMany({
        data: landmarks.map((l) => ({
          name: l.name,
          type: l.type,
          x: l.x,
          y: l.y,
          description: l.description,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      console.error('Error storing landmarks:', error);
    }
  }
}

// Global instance
export const worldStructureService = new WorldStructureService();
