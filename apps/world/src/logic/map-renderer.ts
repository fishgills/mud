import { createCanvas } from 'canvas';
import { BiomeMapper } from './biome-mapper';
import { NoiseGenerator, DEFAULT_WORLD_PARAMETERS } from './noise-generator';

// Define colors for each biome type
const BIOME_COLORS: Record<string, string> = {
  // Water biomes
  ocean: '#1a237e',       // Deep blue
  lake: '#2196f3',        // Light blue
  
  // Coastal biomes
  beach: '#ffeb3b',       // Yellow sand
  
  // Cold biomes
  tundra: '#e0e0e0',      // Light gray
  taiga: '#2e7d32',       // Dark green
  
  // Temperate biomes
  forest: '#4caf50',      // Green
  plains: '#8bc34a',      // Light green
  hills: '#689f38',       // Medium green
  
  // Warm/dry biomes
  savanna: '#ff9800',     // Orange
  desert: '#ffc107',      // Yellow-orange
  
  // Tropical biomes
  jungle: '#1b5e20',      // Very dark green
  rainforest: '#388e3c',  // Medium dark green
  swamp: '#3e2723',       // Dark brown
  
  // Mountain biomes
  mountains: '#795548',   // Brown
  
  // Settlement biomes
  village: '#9c27b0',     // Purple
  city: '#e91e63',        // Pink
  
  // Default for unknown biomes
  unknown: '#000000',     // Black
};

export interface MapRenderOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  pixelSize: number;
}

export async function renderWorldMap(options: MapRenderOptions): Promise<Buffer> {
  const { centerX, centerY, width, height, pixelSize } = options;
  
  // Calculate world coordinates range
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  
  const startX = centerX - halfWidth;
  const endX = centerX + halfWidth;
  const startY = centerY - halfHeight;
  const endY = centerY + halfHeight;
  
  // Create canvas
  const canvasWidth = width * pixelSize;
  const canvasHeight = height * pixelSize;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = BIOME_COLORS.ocean;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Create a noise generator for efficient terrain generation
  const noiseGenerator = new NoiseGenerator(DEFAULT_WORLD_PARAMETERS);
  
  // Generate and render each tile
  for (let worldY = startY; worldY <= endY; worldY++) {
    for (let worldX = startX; worldX <= endX; worldX++) {
      try {
        // Generate terrain data directly (much faster than full tile generation)
        const terrain = noiseGenerator.generateTerrain(worldX, worldY);
        const biomeName = BiomeMapper.getBiome(terrain);
        const color = BIOME_COLORS[biomeName] || BIOME_COLORS.unknown;
        
        // Calculate pixel position (flip Y axis for proper image orientation)
        const pixelX = (worldX - startX) * pixelSize;
        const pixelY = (endY - worldY) * pixelSize;
        
        // Draw pixel block
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
        
        // Add settlement markers if it's a settlement
        if (biomeName === 'village' || biomeName === 'city') {
          const markerSize = Math.max(1, Math.floor(pixelSize / 4));
          const markerX = pixelX + Math.floor(pixelSize / 2) - Math.floor(markerSize / 2);
          const markerY = pixelY + Math.floor(pixelSize / 2) - Math.floor(markerSize / 2);
          
          ctx.fillStyle = biomeName === 'city' ? '#ffffff' : '#ffff00';
          ctx.fillRect(markerX, markerY, markerSize, markerSize);
        }
        
      } catch (error) {
        console.warn(`Failed to generate terrain at (${worldX}, ${worldY}):`, error);
        // Use unknown color for failed tiles
        const pixelX = (worldX - startX) * pixelSize;
        const pixelY = (endY - worldY) * pixelSize;
        ctx.fillStyle = BIOME_COLORS.unknown;
        ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
      }
    }
  }
  
  return canvas.toBuffer('image/png');
}

export function getBiomeColors(): Record<string, string> {
  return { ...BIOME_COLORS };
}
