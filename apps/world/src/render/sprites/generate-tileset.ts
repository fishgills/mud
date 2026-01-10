/**
 * Tileset Generator - Creates a 16x16 pixel sprite for each biome
 *
 * Run this script to regenerate the tileset when biome visuals change:
 * npx ts-node src/render/sprites/generate-tileset.ts
 *
 * The generated tileset is a horizontal strip: 18 biomes × 16px = 288px wide × 16px tall
 * Biome index matches BiomeId (1-based, so index 0 is unused/padding)
 */

import * as pureimage from 'pureimage';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';

// Biome colors and visual styles (matching BiomeId order: 1-18)
const BIOME_STYLES = [
  // Index 0: unused padding (BiomeId starts at 1)
  { color: '#000000', type: 'solid' },
  // 1: OCEAN - Deep blue with wave pattern
  { color: '#4c5aa4', accent: '#3a4888', type: 'waves' },
  // 2: SHALLOW_OCEAN - Lighter blue with subtle waves
  { color: '#4f64c9', accent: '#6b7ed6', type: 'waves' },
  // 3: BEACH - Sandy with dotted texture
  { color: '#f8d796', accent: '#e5c580', type: 'sand' },
  // 4: DESERT - Yellow sand with dunes
  { color: '#f7dc6f', accent: '#e8c84a', type: 'dunes' },
  // 5: GRASSLAND - Green with grass blades
  { color: '#61a84d', accent: '#4d9139', type: 'grass' },
  // 6: FOREST - Dark green with tree clusters
  { color: '#3b8632', accent: '#2d6926', type: 'trees' },
  // 7: JUNGLE - Dense tropical green
  { color: '#1e8449', accent: '#165c36', type: 'jungle' },
  // 8: SWAMP - Murky green/brown
  { color: '#52c41a', accent: '#6b4c3a', type: 'swamp' },
  // 9: LAKE - Fresh blue water
  { color: '#3498db', accent: '#2980b9', type: 'lake' },
  // 10: RIVER - Flowing water
  { color: '#5dade2', accent: '#4a9bc9', type: 'river' },
  // 11: TUNDRA - Cold purple/blue
  { color: '#a8a8fd', accent: '#8888e0', type: 'tundra' },
  // 12: TAIGA - Dark coniferous green
  { color: '#196f3d', accent: '#0f4a29', type: 'conifers' },
  // 13: MOUNTAIN - Rocky brown/gray
  { color: '#533e1a', accent: '#6b5228', type: 'mountain' },
  // 14: SNOWY_MOUNTAIN - White/gray peaks
  { color: '#e2e1de', accent: '#c9c8c5', type: 'snow_peak' },
  // 15: HILLS - Rolling green
  { color: '#a9dfbf', accent: '#8bc9a3', type: 'hills' },
  // 16: SAVANNA - Dry grass yellow-green
  { color: '#98cb2a', accent: '#7fb020', type: 'savanna' },
  // 17: ALPINE - High meadow light green
  { color: '#abebc6', accent: '#8bd4a8', type: 'alpine' },
  // 18: VOLCANIC - Red/black lava
  { color: '#e74c3c', accent: '#1a1a1a', type: 'volcanic' },
];

const TILE_SIZE = 16;
const BIOME_COUNT = 19; // 0-18 (0 is padding)

type Context = ReturnType<pureimage.Bitmap['getContext']>;

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

function drawTile(
  ctx: Context,
  offsetX: number,
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
  ctx.fillRect(offsetX, 0, TILE_SIZE, TILE_SIZE);

  switch (type) {
    case 'waves':
      // Horizontal wave lines
      ctx.fillStyle = accent || lighten(color, 0.15);
      for (let y = 3; y < TILE_SIZE; y += 5) {
        for (let x = 0; x < TILE_SIZE; x += 2) {
          const wave = Math.sin((x + y) * 0.8) > 0.3;
          if (wave) ctx.fillRect(offsetX + x, y, 1, 1);
        }
      }
      // Highlight
      ctx.fillStyle = lighten(color, 0.25);
      ctx.fillRect(offsetX + 2, 2, 2, 1);
      ctx.fillRect(offsetX + 10, 6, 2, 1);
      break;

    case 'sand':
      // Speckled sand texture
      ctx.fillStyle = accent || darken(color, 0.1);
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, y, 1, 1);
      }
      // Light specks
      ctx.fillStyle = lighten(color, 0.2);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, y, 1, 1);
      }
      break;

    case 'dunes':
      // Curved dune lines
      ctx.fillStyle = accent || darken(color, 0.15);
      for (let x = 0; x < TILE_SIZE; x++) {
        const y1 = 4 + Math.floor(Math.sin(x * 0.5) * 2);
        const y2 = 10 + Math.floor(Math.sin(x * 0.5 + 1) * 2);
        ctx.fillRect(offsetX + x, y1, 1, 1);
        ctx.fillRect(offsetX + x, y2, 1, 1);
      }
      // Highlights on dune crests
      ctx.fillStyle = lighten(color, 0.2);
      ctx.fillRect(offsetX + 3, 3, 3, 1);
      ctx.fillRect(offsetX + 10, 9, 3, 1);
      break;

    case 'grass':
      // Grass blade pattern
      ctx.fillStyle = darken(color, 0.15);
      // Scattered grass blades
      const grassPositions = [
        [2, 12],
        [5, 10],
        [8, 13],
        [11, 11],
        [14, 12],
        [3, 6],
        [7, 5],
        [12, 7],
      ];
      for (const [x, y] of grassPositions) {
        ctx.fillRect(offsetX + x, y - 2, 1, 3);
      }
      // Light grass tips
      ctx.fillStyle = lighten(color, 0.15);
      for (const [x, y] of grassPositions.slice(0, 4)) {
        ctx.fillRect(offsetX + x, y - 2, 1, 1);
      }
      break;

    case 'trees':
      // Tree cluster pattern
      // Tree trunks
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(offsetX + 4, 10, 2, 4);
      ctx.fillRect(offsetX + 11, 8, 2, 5);
      // Tree canopy (dark)
      ctx.fillStyle = darken(color, 0.2);
      ctx.fillRect(offsetX + 2, 6, 6, 5);
      ctx.fillRect(offsetX + 9, 4, 5, 5);
      // Tree canopy (light)
      ctx.fillStyle = lighten(color, 0.1);
      ctx.fillRect(offsetX + 3, 7, 4, 3);
      ctx.fillRect(offsetX + 10, 5, 3, 3);
      break;

    case 'jungle':
      // Dense jungle vegetation
      ctx.fillStyle = darken(color, 0.25);
      // Dense undergrowth
      for (let x = 0; x < TILE_SIZE; x += 2) {
        for (let y = 8; y < TILE_SIZE; y += 2) {
          ctx.fillRect(offsetX + x, y, 2, 2);
        }
      }
      // Canopy layers
      ctx.fillStyle = color;
      for (let x = 0; x < TILE_SIZE; x += 3) {
        ctx.fillRect(offsetX + x, 2 + (x % 6), 3, 6);
      }
      // Highlights
      ctx.fillStyle = lighten(color, 0.15);
      ctx.fillRect(offsetX + 2, 3, 2, 2);
      ctx.fillRect(offsetX + 8, 4, 2, 2);
      break;

    case 'swamp':
      // Murky water with vegetation
      ctx.fillStyle = darken(color, 0.3);
      // Dark water patches
      ctx.fillRect(offsetX + 2, 8, 4, 4);
      ctx.fillRect(offsetX + 10, 5, 4, 5);
      // Lily pads
      ctx.fillStyle = lighten(color, 0.1);
      ctx.fillRect(offsetX + 4, 9, 2, 2);
      ctx.fillRect(offsetX + 12, 7, 2, 2);
      // Dead trees
      ctx.fillStyle = accent || '#6b4c3a';
      ctx.fillRect(offsetX + 7, 3, 1, 8);
      ctx.fillRect(offsetX + 6, 4, 1, 2);
      ctx.fillRect(offsetX + 8, 5, 1, 2);
      break;

    case 'lake':
      // Calm water with reflections
      ctx.fillStyle = darken(color, 0.1);
      // Subtle ripples
      for (let y = 4; y < TILE_SIZE; y += 4) {
        ctx.fillRect(offsetX + 2, y, 5, 1);
        ctx.fillRect(offsetX + 9, y + 2, 5, 1);
      }
      // Sparkle
      ctx.fillStyle = lighten(color, 0.35);
      ctx.fillRect(offsetX + 4, 3, 2, 1);
      ctx.fillRect(offsetX + 11, 7, 2, 1);
      break;

    case 'river':
      // Flowing water with current lines
      ctx.fillStyle = darken(color, 0.1);
      // Flow lines
      for (let x = 0; x < TILE_SIZE; x += 3) {
        ctx.fillRect(offsetX + x, 4, 2, 1);
        ctx.fillRect(offsetX + x + 1, 8, 2, 1);
        ctx.fillRect(offsetX + x, 12, 2, 1);
      }
      // Foam/highlights
      ctx.fillStyle = lighten(color, 0.3);
      ctx.fillRect(offsetX + 2, 6, 1, 1);
      ctx.fillRect(offsetX + 10, 10, 1, 1);
      break;

    case 'tundra':
      // Frozen ground with patches
      ctx.fillStyle = darken(color, 0.1);
      // Ice patches
      ctx.fillRect(offsetX + 1, 2, 4, 3);
      ctx.fillRect(offsetX + 8, 6, 5, 4);
      ctx.fillRect(offsetX + 3, 11, 4, 3);
      // Snow highlights
      ctx.fillStyle = lighten(color, 0.2);
      ctx.fillRect(offsetX + 2, 3, 2, 1);
      ctx.fillRect(offsetX + 9, 7, 2, 2);
      break;

    case 'conifers':
      // Coniferous trees (triangular)
      // Trunks
      ctx.fillStyle = '#3d2817';
      ctx.fillRect(offsetX + 4, 11, 1, 4);
      ctx.fillRect(offsetX + 11, 10, 1, 5);
      // Triangular trees
      ctx.fillStyle = darken(color, 0.15);
      // Tree 1
      ctx.fillRect(offsetX + 4, 8, 1, 3);
      ctx.fillRect(offsetX + 3, 9, 3, 2);
      ctx.fillRect(offsetX + 2, 10, 5, 1);
      // Tree 2
      ctx.fillRect(offsetX + 11, 7, 1, 3);
      ctx.fillRect(offsetX + 10, 8, 3, 2);
      ctx.fillRect(offsetX + 9, 9, 5, 1);
      // Snow on branches
      ctx.fillStyle = lighten(color, 0.4);
      ctx.fillRect(offsetX + 4, 8, 1, 1);
      ctx.fillRect(offsetX + 11, 7, 1, 1);
      break;

    case 'mountain':
      // Rocky mountain peak
      // Dark crevices
      ctx.fillStyle = darken(color, 0.3);
      ctx.fillRect(offsetX + 4, 8, 2, 6);
      ctx.fillRect(offsetX + 10, 6, 2, 8);
      // Rock faces
      ctx.fillStyle = lighten(color, 0.15);
      ctx.fillRect(offsetX + 6, 4, 4, 8);
      ctx.fillRect(offsetX + 2, 10, 4, 4);
      // Peak highlight
      ctx.fillStyle = lighten(color, 0.25);
      ctx.fillRect(offsetX + 7, 2, 2, 3);
      break;

    case 'snow_peak':
      // Snowy mountain peaks
      // Rock showing through
      ctx.fillStyle = '#888888';
      ctx.fillRect(offsetX + 3, 10, 3, 5);
      ctx.fillRect(offsetX + 10, 8, 3, 6);
      // Snow
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offsetX + 5, 2, 6, 7);
      ctx.fillRect(offsetX + 2, 6, 4, 5);
      ctx.fillRect(offsetX + 10, 4, 4, 5);
      // Shadows
      ctx.fillStyle = accent || darken(color, 0.15);
      ctx.fillRect(offsetX + 4, 7, 2, 3);
      ctx.fillRect(offsetX + 9, 6, 2, 3);
      break;

    case 'hills':
      // Rolling hills
      // Hill shadows
      ctx.fillStyle = darken(color, 0.15);
      ctx.fillRect(offsetX + 0, 10, 8, 6);
      ctx.fillRect(offsetX + 8, 8, 8, 8);
      // Hill highlights
      ctx.fillStyle = lighten(color, 0.1);
      ctx.fillRect(offsetX + 2, 8, 5, 3);
      ctx.fillRect(offsetX + 10, 6, 4, 3);
      // Grass details
      ctx.fillStyle = darken(color, 0.2);
      ctx.fillRect(offsetX + 4, 7, 1, 2);
      ctx.fillRect(offsetX + 12, 5, 1, 2);
      break;

    case 'savanna':
      // Dry grassland with scattered trees
      // Dry patches
      ctx.fillStyle = darken(color, 0.2);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(rand() * TILE_SIZE);
        const y = Math.floor(rand() * TILE_SIZE);
        ctx.fillRect(offsetX + x, y, 2, 1);
      }
      // Acacia-style tree
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(offsetX + 7, 6, 2, 8);
      ctx.fillStyle = '#8b9d4a';
      ctx.fillRect(offsetX + 3, 4, 10, 3);
      ctx.fillRect(offsetX + 5, 3, 6, 1);
      break;

    case 'alpine':
      // High meadow with flowers
      // Grass base is already filled
      // Flower spots
      const flowerColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = flowerColors[i % flowerColors.length];
        const x = Math.floor(rand() * (TILE_SIZE - 2)) + 1;
        const y = Math.floor(rand() * (TILE_SIZE - 2)) + 1;
        ctx.fillRect(offsetX + x, y, 1, 1);
      }
      // Light grass highlights
      ctx.fillStyle = lighten(color, 0.15);
      ctx.fillRect(offsetX + 2, 5, 1, 3);
      ctx.fillRect(offsetX + 10, 8, 1, 3);
      break;

    case 'volcanic':
      // Volcanic terrain with lava
      // Dark volcanic rock
      ctx.fillStyle = accent || '#1a1a1a';
      ctx.fillRect(offsetX + 0, 0, TILE_SIZE, TILE_SIZE);
      // Lava cracks
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + 2, 4, 1, 8);
      ctx.fillRect(offsetX + 2, 11, 6, 1);
      ctx.fillRect(offsetX + 7, 7, 1, 5);
      ctx.fillRect(offsetX + 10, 2, 1, 6);
      ctx.fillRect(offsetX + 10, 7, 4, 1);
      // Bright lava glow
      ctx.fillStyle = '#ff8c00';
      ctx.fillRect(offsetX + 3, 6, 1, 3);
      ctx.fillRect(offsetX + 11, 4, 1, 2);
      // Lava pools
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(offsetX + 4, 8, 2, 2);
      break;

    default:
      // Solid color fallback
      break;
  }
}

async function generateTileset(): Promise<void> {
  console.log('Generating biome tileset...');

  const width = BIOME_COUNT * TILE_SIZE;
  const height = TILE_SIZE;
  const bitmap = pureimage.make(width, height);
  const ctx = bitmap.getContext('2d');

  // Clear with transparent
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, width, height);

  // Draw each biome tile
  for (let i = 0; i < BIOME_COUNT; i++) {
    const style = BIOME_STYLES[i];
    if (style) {
      drawTile(ctx, i * TILE_SIZE, style, i);
      console.log(`  Drew biome ${i}: ${style.type}`);
    }
  }

  // Save to file
  const outputPath = path.join(__dirname, 'tileset.png');

  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('finish', resolve);
    stream.on('error', reject);
    pureimage.encodePNGToStream(bitmap, stream).catch(reject);
  });

  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Tileset saved to: ${outputPath}`);
  console.log(
    `Size: ${width}x${height} pixels (${BIOME_COUNT} biomes × ${TILE_SIZE}px)`,
  );
}

// Run if executed directly
if (require.main === module) {
  generateTileset().catch(console.error);
}

export { generateTileset, TILE_SIZE, BIOME_COUNT };
