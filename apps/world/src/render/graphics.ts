/**
 * Graphics utilities for map rendering
 *
 * These helpers add visual polish on top of sprite-based tile rendering:
 * - drawBiomeEdges: Highlights borders between different biomes
 * - drawHeightShading: Adds height-based lighting for terrain depth
 */

import type { Context as RenderContext } from 'pureimage';
import { BIOMES } from '../constants';

type RGB = { r: number; g: number; b: number };

// Color utilities
function hexToRgb(hex: string): RGB {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const v =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(c: RGB): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}

function lightenDarken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  const delta = Math.max(-1, Math.min(1, amount)) * 255;
  return rgbToHex({ r: c.r + delta, g: c.g + delta, b: c.b + delta });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Draw edge highlights between different biomes
 * Adds visual separation with light/dark borders
 */
export function drawBiomeEdges(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biome: (typeof BIOMES)[keyof typeof BIOMES],
  north: (typeof BIOMES)[keyof typeof BIOMES] | null,
  south: (typeof BIOMES)[keyof typeof BIOMES] | null,
  east: (typeof BIOMES)[keyof typeof BIOMES] | null,
  west: (typeof BIOMES)[keyof typeof BIOMES] | null,
) {
  const edgeW = Math.max(1, Math.floor(p / 6));
  const dark = lightenDarken(biome.color, -0.12);
  const light = lightenDarken(biome.color, 0.12);
  if (north && north.name !== biome.name) {
    ctx.fillStyle = dark;
    ctx.fillRect(pixelX, pixelY, p, edgeW);
  }
  if (south && south.name !== biome.name) {
    ctx.fillStyle = dark;
    ctx.fillRect(pixelX, pixelY + p - edgeW, p, edgeW);
  }
  if (east && east.name !== biome.name) {
    ctx.fillStyle = light;
    ctx.fillRect(pixelX + p - edgeW, pixelY, edgeW, p);
  }
  if (west && west.name !== biome.name) {
    ctx.fillStyle = light;
    ctx.fillRect(pixelX, pixelY, edgeW, p);
  }
}

/**
 * Draw height-based shading for terrain depth
 * Uses gradient-based lighting to simulate 3D terrain
 */
export function drawHeightShading(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  worldX: number,
  worldY: number,
  heightMap: Map<string, number>,
) {
  const key = `${worldX},${worldY}`;
  if (!heightMap.has(key)) return;
  const h = heightMap.get(key) ?? 0;
  const getHeight = (x: number, y: number) => heightMap.get(`${x},${y}`) ?? h;
  const east = getHeight(worldX + 1, worldY);
  const west = getHeight(worldX - 1, worldY);
  const north = getHeight(worldX, worldY + 1);
  const south = getHeight(worldX, worldY - 1);
  const gradX = east - west;
  const gradY = north - south;
  const light = { x: -0.7, y: 0.5 };
  const len = Math.hypot(light.x, light.y) || 1;
  light.x /= len;
  light.y /= len;
  const slope = gradX * light.x + gradY * light.y;
  const ambient = (h - 0.5) * 0.25;
  const intensity = slope * 1.4 + ambient;
  if (Math.abs(intensity) < 0.015) return;
  const alpha = clamp(Math.abs(intensity), 0.04, 0.38);
  ctx.fillStyle =
    intensity > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
  ctx.fillRect(pixelX, pixelY, p, p);
}
