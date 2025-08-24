import { CanvasRenderingContext2D } from 'canvas';
import { BIOMES } from '../constants';

// Deterministic hashing and random helpers
function hash32(x: number, y: number, seed: number, salt = 0): number {
  let a = (x | 0) ^ 0x9e3779b9;
  let b = (y | 0) ^ 0x85ebca6b;
  let c = (seed | 0) ^ 0xc2b2ae35 ^ (salt | 0);
  a -= b;
  a -= c;
  a ^= c >>> 13;
  b -= c;
  b -= a;
  b ^= a << 8;
  c -= a;
  c -= b;
  c ^= b >>> 13;
  a -= b;
  a -= c;
  a ^= c >>> 12;
  b -= c;
  b -= a;
  b ^= a << 16;
  c -= a;
  c -= b;
  c ^= b >>> 5;
  a -= b;
  a -= c;
  a ^= c >>> 3;
  b -= c;
  b -= a;
  b ^= a << 10;
  c -= a;
  c -= b;
  c ^= b >>> 15;
  return (c >>> 0) & 0xffffffff;
}

function rand01(x: number, y: number, seed: number, salt = 0): number {
  return (hash32(x, y, seed, salt) % 1000000) / 1000000;
}

// Color utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } {
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

function rgbToHex(c: { r: number; g: number; b: number }): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}

export function lightenDarken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  const delta = Math.max(-1, Math.min(1, amount)) * 255;
  return rgbToHex({ r: c.r + delta, g: c.g + delta, b: c.b + delta });
}

export function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const m = (u: number, v: number) => u + (v - u) * t;
  return rgbToHex({ r: m(a.r, b.r), g: m(a.g, b.g), b: m(a.b, b.b) } as any);
}

// Drawing helpers
export function drawBiomeTile(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  p: number,
  biome: (typeof BIOMES)[keyof typeof BIOMES],
  worldX: number,
  worldY: number,
  seed: number,
) {
  // Base fill
  ctx.fillStyle = biome.color;
  ctx.fillRect(pixelX, pixelY, p, p);

  // Sub-tile texturing parameters
  const name = biome.name.toUpperCase();
  const nInit = Math.max(2, Math.min(4, Math.floor(p / 2)));
  const cell = Math.max(1, Math.floor(p / nInit));
  const nEff = Math.max(1, Math.min(nInit, Math.floor(p / cell)));
  const padX = Math.max(0, Math.floor((p - cell * nEff) / 2));
  const padY = Math.max(0, Math.floor((p - cell * nEff) / 2));

  const base = biome.color;

  // Choose style parameters
  let amp = 0.08;
  let altColor: string | null = null;
  let bandFreq = 0;
  if (name.includes('OCEAN') || name === 'LAKE' || name === 'RIVER') {
    amp = 0.1;
    altColor = lightenDarken(base, 0.08);
    bandFreq = 1.8;
  } else if (name === 'DESERT') {
    amp = 0.12;
    altColor = lightenDarken(base, 0.12);
    bandFreq = 1.6;
  } else if (name === 'BEACH') {
    amp = 0.08;
    altColor = lightenDarken(base, 0.1);
    bandFreq = 1.2;
  } else if (name === 'SAVANNA') {
    amp = 0.06;
    altColor = lightenDarken(base, 0.06);
  } else if (name === 'FOREST' || name === 'TAIGA' || name === 'JUNGLE') {
    amp = 0.12;
    altColor = lightenDarken(base, -0.12);
  } else if (name === 'SWAMP') {
    amp = 0.1;
    altColor = lightenDarken(base, -0.1);
  } else if (name === 'MOUNTAIN' || name === 'HILLS' || name === 'ALPINE') {
    amp = 0.14;
    altColor = lightenDarken(base, -0.1);
  } else if (
    name === 'SNOWY MOUNTAIN' ||
    name === 'SNOWY_MOUNTAIN' ||
    name === 'TUNDRA'
  ) {
    amp = 0.08;
    altColor = mix(base, '#bcd6ff', 0.15);
  } else if (name === 'VOLCANIC') {
    amp = 0.12;
    altColor = lightenDarken(base, -0.15);
  } else {
    amp = 0.08;
    altColor = lightenDarken(base, 0.06);
  }

  const lightDir = 0.25;
  for (let j = 0; j < nEff; j++) {
    for (let i = 0; i < nEff; i++) {
      const nx = worldX * 31 + i;
      const ny = worldY * 17 + j;
      const r = rand01(nx, ny, seed, 1337);
      const band = bandFreq
        ? Math.sin(
            (worldX * 0.5 + worldY * 0.3 + i * 0.4 + j * 0.2 + seed * 0.0001) *
              bandFreq,
          ) *
            0.5 +
          0.5
        : 0.5;
      const bias =
        (nEff - 1 - i + (nEff - 1 - j)) / (2 * Math.max(1, nEff - 1));
      let t = r * 0.6 + band * 0.4;
      t = t * (1 - lightDir) + bias * lightDir;

      let color = base;
      if (altColor) {
        const s = (t - 0.5) * 2;
        const mag = Math.max(-1, Math.min(1, (s * amp) / 0.5));
        color = mag >= 0 ? mix(base, altColor, mag) : lightenDarken(base, mag);
      } else {
        color = lightenDarken(base, (t - 0.5) * 2 * amp);
      }
      ctx.fillStyle = color;
      ctx.fillRect(
        pixelX + padX + i * cell,
        pixelY + padY + j * cell,
        cell,
        cell,
      );
    }
  }
}

export function drawBiomeEdges(
  ctx: CanvasRenderingContext2D,
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
