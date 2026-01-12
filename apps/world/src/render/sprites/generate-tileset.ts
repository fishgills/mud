/**
 * Tileset Generator - Creates a 16x16 pixel sprite for each biome with 47 autotile variants
 *
 * Run this script to generate the tileset:
 * npx ts-node src/render/sprites/generate-tileset.ts
 *
 * Generated tileset: 47 columns × 18 rows = 752×288 pixels
 * Each row is a biome (BiomeId 1-18), each column is a tile variant (0-46)
 */

import * as pureimage from 'pureimage';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';
import { TileVariant } from './autotile-mapping';

const TILE_SIZE = 16;
const VARIANT_COUNT = 47;
const BIOME_COUNT = 18;

type Context = ReturnType<pureimage.Bitmap['getContext']>;

// Biome visual styles (matching BiomeId 1-18)
const BIOME_STYLES = [
  // 1: OCEAN
  { color: '#4c5aa4', accent: '#3a4888', type: 'waves' },
  // 2: SHALLOW_OCEAN
  { color: '#4f64c9', accent: '#6b7ed6', type: 'waves' },
  // 3: BEACH
  { color: '#f8d796', accent: '#e5c580', type: 'sand' },
  // 4: DESERT
  { color: '#f7dc6f', accent: '#e8c84a', type: 'dunes' },
  // 5: GRASSLAND
  { color: '#61a84d', accent: '#4d9139', type: 'grass' },
  // 6: FOREST
  { color: '#3b8632', accent: '#2d6926', type: 'trees' },
  // 7: JUNGLE
  { color: '#1e8449', accent: '#165c36', type: 'jungle' },
  // 8: SWAMP
  { color: '#52c41a', accent: '#6b4c3a', type: 'swamp' },
  // 9: LAKE
  { color: '#3498db', accent: '#2980b9', type: 'lake' },
  // 10: RIVER
  { color: '#5dade2', accent: '#4a9bc9', type: 'river' },
  // 11: TUNDRA
  { color: '#a8a8fd', accent: '#8888e0', type: 'tundra' },
  // 12: TAIGA
  { color: '#196f3d', accent: '#0f4a29', type: 'conifers' },
  // 13: MOUNTAIN
  { color: '#533e1a', accent: '#6b5228', type: 'mountain' },
  // 14: SNOWY_MOUNTAIN
  { color: '#e2e1de', accent: '#c9c8c5', type: 'snow_peak' },
  // 15: HILLS
  { color: '#a9dfbf', accent: '#8bc9a3', type: 'hills' },
  // 16: SAVANNA
  { color: '#98cb2a', accent: '#7fb020', type: 'savanna' },
  // 17: ALPINE
  { color: '#abebc6', accent: '#8bd4a8', type: 'alpine' },
  // 18: VOLCANIC
  { color: '#e74c3c', accent: '#1a1a1a', type: 'volcanic' },
];

// Color utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// Seeded random for deterministic patterns
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Draw a base tile (variant 0 = center/full tile)
 */
function drawBaseTile(
  ctx: Context,
  offsetX: number,
  offsetY: number,
  style: (typeof BIOME_STYLES)[number],
  biomeIndex: number,
): void {
  const { color, accent, type } = style as {
    color: string;
    accent?: string;
    type: string;
  };
  const rand = seededRandom(biomeIndex * 1000);

  // Fill base color
  ctx.fillStyle = color;
  ctx.fillRect(offsetX, offsetY, TILE_SIZE, TILE_SIZE);

  // Add pattern based on biome type
  switch (type) {
    case 'waves':
      // Horizontal wave lines
      ctx.fillStyle = accent || lighten(color, 0.15);
      for (let y = 3; y < TILE_SIZE; y += 5) {
        for (let x = 0; x < TILE_SIZE; x += 2) {
          const wave = Math.sin((x + y) * 0.8) > 0.3;
          if (wave) ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
        }
      }
      break;

    case 'sand':
    case 'dunes':
      // Speckled texture
      ctx.fillStyle = accent || darken(color, 0.1);
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
      }
      break;

    case 'grass':
    case 'savanna':
    case 'alpine':
      // Grass blades
      ctx.fillStyle = darken(color, 0.15);
      const grassPos = [
        [2, 12],
        [5, 10],
        [8, 13],
        [11, 11],
        [14, 12],
      ];
      for (const [x, y] of grassPos) {
        ctx.fillRect(offsetX + x, offsetY + y - 2, 1, 3);
      }
      break;

    case 'trees':
    case 'jungle':
    case 'conifers':
      // Tree clusters
      ctx.fillStyle = darken(color, 0.25);
      ctx.fillRect(offsetX + 3, offsetY + 10, 2, 5);
      ctx.fillRect(offsetX + 11, offsetY + 9, 2, 6);
      ctx.fillStyle = lighten(color, 0.15);
      ctx.fillRect(offsetX + 2, offsetY + 5, 4, 5);
      ctx.fillRect(offsetX + 10, offsetY + 4, 4, 5);
      break;

    case 'mountain':
    case 'hills':
      // Rocky texture
      ctx.fillStyle = accent || darken(color, 0.2);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, offsetY + y, 2, 2);
      }
      break;

    case 'volcanic':
      // Lava cracks
      ctx.fillStyle = accent || '#000';
      for (let y = 2; y < TILE_SIZE; y += 4) {
        for (let x = 0; x < TILE_SIZE; x += 3) {
          ctx.fillRect(offsetX + x, offsetY + y, 1, 2);
        }
      }
      break;

    case 'swamp':
      // Murky water with vegetation
      ctx.fillStyle = darken(color, 0.2);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
      }
      break;

    case 'tundra':
    case 'snow_peak':
      // Snow/ice texture
      ctx.fillStyle = lighten(color, 0.15);
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, offsetY + y, 2, 1);
      }
      break;

    case 'lake':
    case 'river':
      // Flowing water
      ctx.fillStyle = accent || lighten(color, 0.1);
      for (let y = 4; y < TILE_SIZE; y += 6) {
        for (let x = 0; x < TILE_SIZE; x += 3) {
          ctx.fillRect(offsetX + x, offsetY + y, 2, 1);
        }
      }
      break;
  }
}

/**
 * Apply alpha mask to create edge/corner variants.
 * Mask types: 'edge-n', 'edge-e', 'edge-s', 'edge-w', 'corner-ne', etc.
 */
function applyMask(
  bitmap: pureimage.Bitmap,
  offsetX: number,
  offsetY: number,
  variant: TileVariant,
): void {
  // Simple mask approach: make certain regions transparent based on variant
  // For a proper implementation, you'd have detailed masks for all 47 variants
  // This is a simplified version that handles the most common cases

  const data = bitmap.data;
  const width = bitmap.width;

  function setAlpha(x: number, y: number, alpha: number): void {
    const pixelX = offsetX + x;
    const pixelY = offsetY + y;
    if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= bitmap.height)
      return;
    const idx = (pixelY * width + pixelX) * 4 + 3; // Alpha channel
    data[idx] = Math.floor(alpha * 255);
  }

  // Apply gradient transparency based on variant type
  const fadeRadius = 6;

  switch (variant) {
    case TileVariant.EDGE_N:
      for (let y = 0; y < fadeRadius; y++) {
        const alpha = y / fadeRadius;
        for (let x = 0; x < TILE_SIZE; x++) {
          setAlpha(x, y, alpha);
        }
      }
      break;

    case TileVariant.EDGE_S:
      for (let y = 0; y < fadeRadius; y++) {
        const alpha = y / fadeRadius;
        for (let x = 0; x < TILE_SIZE; x++) {
          setAlpha(x, TILE_SIZE - 1 - y, alpha);
        }
      }
      break;

    case TileVariant.EDGE_E:
      for (let x = 0; x < fadeRadius; x++) {
        const alpha = x / fadeRadius;
        for (let y = 0; y < TILE_SIZE; y++) {
          setAlpha(TILE_SIZE - 1 - x, y, alpha);
        }
      }
      break;

    case TileVariant.EDGE_W:
      for (let x = 0; x < fadeRadius; x++) {
        const alpha = x / fadeRadius;
        for (let y = 0; y < TILE_SIZE; y++) {
          setAlpha(x, y, alpha);
        }
      }
      break;

    case TileVariant.CORNER_NE:
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const distToCorner = Math.sqrt(
            Math.pow(x - TILE_SIZE, 2) + Math.pow(y, 2),
          );
          const alpha = Math.min(1, distToCorner / fadeRadius);
          setAlpha(x, y, alpha);
        }
      }
      break;

    case TileVariant.CORNER_SE:
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const distToCorner = Math.sqrt(
            Math.pow(x - TILE_SIZE, 2) + Math.pow(y - TILE_SIZE, 2),
          );
          const alpha = Math.min(1, distToCorner / fadeRadius);
          setAlpha(x, y, alpha);
        }
      }
      break;

    case TileVariant.CORNER_SW:
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const distToCorner = Math.sqrt(
            Math.pow(x, 2) + Math.pow(y - TILE_SIZE, 2),
          );
          const alpha = Math.min(1, distToCorner / fadeRadius);
          setAlpha(x, y, alpha);
        }
      }
      break;

    case TileVariant.CORNER_NW:
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const distToCorner = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
          const alpha = Math.min(1, distToCorner / fadeRadius);
          setAlpha(x, y, alpha);
        }
      }
      break;

    case TileVariant.ISLAND:
      // Circular fade from center
      const centerX = TILE_SIZE / 2;
      const centerY = TILE_SIZE / 2;
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const dist = Math.sqrt(
            Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2),
          );
          const alpha = Math.min(1, dist / (TILE_SIZE / 2));
          setAlpha(x, y, 1 - alpha);
        }
      }
      break;

    // For other variants, use combinations of the above masks
    // This is simplified - a full implementation would have specific masks for all 47 variants
    default:
      // No mask for CENTER and complex variants (for now)
      break;
  }
}

/**
 * Generate the full tileset
 */
async function generateTileset(): Promise<void> {
  const canvasWidth = VARIANT_COUNT * TILE_SIZE;
  const canvasHeight = BIOME_COUNT * TILE_SIZE;

  const bitmap = pureimage.make(canvasWidth, canvasHeight);
  const ctx = bitmap.getContext('2d');

  console.log(
    `Generating tileset: ${canvasWidth}x${canvasHeight} (${VARIANT_COUNT} variants × ${BIOME_COUNT} biomes)`,
  );

  // Generate each biome's variants
  for (let biomeIdx = 0; biomeIdx < BIOME_COUNT; biomeIdx++) {
    const style = BIOME_STYLES[biomeIdx];
    const rowY = biomeIdx * TILE_SIZE;

    console.log(
      `  Generating biome ${biomeIdx + 1}/${BIOME_COUNT} (${style.type})...`,
    );

    for (let variantIdx = 0; variantIdx < VARIANT_COUNT; variantIdx++) {
      const colX = variantIdx * TILE_SIZE;

      // Draw base tile
      drawBaseTile(ctx, colX, rowY, style, biomeIdx + 1);

      // Apply mask for this variant
      applyMask(bitmap, colX, rowY, variantIdx as TileVariant);
    }
  }

  // Save to file
  const outputPath = path.join(__dirname, 'tileset.png');
  const stream = fs.createWriteStream(outputPath);

  await pureimage.encodePNGToStream(bitmap, stream);

  console.log(`✓ Tileset generated: ${outputPath}`);
  console.log(`  Size: ${canvasWidth}×${canvasHeight} pixels`);
  console.log(`  Variants per biome: ${VARIANT_COUNT}`);
  console.log(`  Total tiles: ${VARIANT_COUNT * BIOME_COUNT}`);

  const stats = fs.statSync(outputPath);
  console.log(`  File size: ${Math.round(stats.size / 1024)} KB`);
}

// Run generator
generateTileset()
  .then(() => {
    console.log('\nTileset generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Tileset generation failed:', error);
    process.exit(1);
  });
