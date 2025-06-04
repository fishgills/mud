/**
 * Consolidated biome definitions for the MUD world generation system.
 * This file contains all biome information in a single structure.
 */

export interface BiomeDefinition {
  name: string;
  color: string; // Hex color for map visualization
  letter: string; // Single letter for text grid display
  priority: number; // Higher numbers have priority in biome matching
  heightRange: [number, number]; // Min and max height values (0-1)
  temperatureRange: [number, number]; // Min and max temperature values (0-1)
  moistureRange: [number, number]; // Min and max moisture values (0-1)
}

// Comprehensive biome definitions with distinct colors for better visualization
export const BIOME_DEFINITIONS: BiomeDefinition[] = [
  // Water biomes (highest priority for low height)
  {
    name: 'ocean',
    color: '#1565C0', // Deep ocean blue - darker than other water biomes
    letter: 'O',
    priority: 10,
    heightRange: [0.0, 0.5], // Reduced from 0.55 to make room for more land
    temperatureRange: [0.0, 1.0],
    moistureRange: [0.5, 1.0],
  },
  {
    name: 'lake',
    color: '#42A5F5', // Bright sky blue - lighter than ocean for distinction
    letter: 'L',
    priority: 9,
    heightRange: [0.65, 0.75], // Moved higher to avoid ocean areas, smaller range
    temperatureRange: [0.2, 0.8], // More restricted temperature range
    moistureRange: [0.8, 1.0], // Higher moisture requirement to ensure they're in wet areas
  },

  // Coastal biomes
  {
    name: 'beach',
    color: '#F5DEB3', // Sandy beige - more realistic sand color
    letter: 'B',
    priority: 6, // Reduced priority from 8 to make beaches less common
    heightRange: [0.5, 0.58], // Narrower range, right at ocean edge
    temperatureRange: [0.4, 1.0], // Slightly more restricted
    moistureRange: [0.4, 0.7], // Reduced upper moisture to avoid wet areas
  },

  // Cold biomes (low temperature)
  {
    name: 'tundra',
    color: '#E8F4F8', // Pale icy blue-white - cold and barren appearance
    letter: 'T',
    priority: 7,
    heightRange: [0.2, 0.8],
    temperatureRange: [0.0, 0.2],
    moistureRange: [0.0, 0.6],
  },
  {
    name: 'taiga',
    color: '#2E5266', // Dark blue-green - coniferous forest color
    letter: 'A',
    priority: 6,
    heightRange: [0.4, 0.8],
    temperatureRange: [0.1, 0.4],
    moistureRange: [0.4, 0.8],
  },

  // Mountain biomes (high elevation)
  {
    name: 'mountains',
    color: '#8D6E63', // Rocky brown-gray - stone and exposed rock
    letter: 'M',
    priority: 9, // Increased priority from 8 to make mountains more prominent
    heightRange: [0.75, 1.0], // Lowered from 0.8 to create more mountain ranges
    temperatureRange: [0.0, 0.6],
    moistureRange: [0.0, 1.0],
  },

  // Temperate biomes
  {
    name: 'forest',
    color: '#388E3C', // Rich forest green - lush deciduous trees
    letter: 'F',
    priority: 5,
    heightRange: [0.4, 0.8],
    temperatureRange: [0.3, 0.7],
    moistureRange: [0.6, 1.0],
  },
  {
    name: 'hills',
    color: '#7CB342', // Bright grass green - rolling grassy hills
    letter: 'H',
    priority: 4,
    heightRange: [0.6, 0.8],
    temperatureRange: [0.3, 0.8],
    moistureRange: [0.3, 0.7],
  },
  {
    name: 'plains',
    color: '#9CCC65', // Light meadow green - open grasslands
    letter: 'P',
    priority: 3,
    heightRange: [0.4, 0.6],
    temperatureRange: [0.3, 0.8],
    moistureRange: [0.3, 0.7],
  },

  // Warm/dry biomes
  {
    name: 'savanna',
    color: '#FF8F00', // Golden orange - dry grasslands with scattered trees
    letter: 'S',
    priority: 4,
    heightRange: [0.4, 0.7],
    temperatureRange: [0.6, 0.9],
    moistureRange: [0.2, 0.5],
  },
  {
    name: 'desert',
    color: '#FDD835', // Bright sand yellow - hot arid landscape
    letter: 'D',
    priority: 5,
    heightRange: [0.4, 0.8],
    temperatureRange: [0.7, 1.0],
    moistureRange: [0.0, 0.3],
  },

  // Tropical biomes (high temperature, high moisture)
  {
    name: 'rainforest',
    color: '#1B5E20', // Very dark green - dense tropical canopy
    letter: 'R',
    priority: 6,
    heightRange: [0.4, 0.7],
    temperatureRange: [0.7, 1.0],
    moistureRange: [0.8, 1.0],
  },
  {
    name: 'jungle',
    color: '#2E7D32', // Deep jungle green - thick vegetation, lighter than rainforest
    letter: 'J',
    priority: 5,
    heightRange: [0.4, 0.7],
    temperatureRange: [0.6, 0.9],
    moistureRange: [0.7, 0.9],
  },

  // Wetland biomes
  {
    name: 'swamp',
    color: '#4A148C', // Dark purple-brown - murky water and rotting vegetation
    letter: 'W',
    priority: 4,
    heightRange: [0.55, 0.7], // Adjusted to start where ocean ends
    temperatureRange: [0.4, 0.8],
    moistureRange: [0.8, 1.0],
  },

  // (Settlement biomes removed)
];

// Helper functions for accessing biome data
export class BiomeRegistry {
  private static biomeMap = new Map(BIOME_DEFINITIONS.map((b) => [b.name, b]));

  static getByName(name: string): BiomeDefinition | undefined {
    return this.biomeMap.get(name);
  }

  static getAllNames(): string[] {
    return BIOME_DEFINITIONS.map((b) => b.name);
  }

  static getColorMap(): Record<string, string> {
    const colors: Record<string, string> = {};
    BIOME_DEFINITIONS.forEach((biome) => {
      colors[biome.name] = biome.color;
    });
    colors.unknown = '#000000'; // Add unknown fallback
    return colors;
  }

  static getLetterMap(): Record<string, string> {
    const letters: Record<string, string> = {};
    BIOME_DEFINITIONS.forEach((biome) => {
      letters[biome.name] = biome.letter;
    });
    return letters;
  }

  static getBiomeRules() {
    return BIOME_DEFINITIONS.map((biome) => ({
      name: biome.name,
      priority: biome.priority,
      heightRange: biome.heightRange,
      temperatureRange: biome.temperatureRange,
      moistureRange: biome.moistureRange,
    }));
  }

  static isSettlement(): boolean {
    return false;
  }
}

// Legacy export for backward compatibility
export const BIOMES = BIOME_DEFINITIONS.map((b) => ({ name: b.name }));
