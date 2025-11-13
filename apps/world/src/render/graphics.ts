import type { Context as RenderContext } from 'pureimage';
import { BIOMES } from '../constants';

type RGB = { r: number; g: number; b: number };

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

export function lightenDarken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  const delta = Math.max(-1, Math.min(1, amount)) * 255;
  return rgbToHex({ r: c.r + delta, g: c.g + delta, b: c.b + delta });
}

export function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const m = (u: number, v: number) => u + (v - u) * t;
  const mixed: RGB = { r: m(a.r, b.r), g: m(a.g, b.g), b: m(a.b, b.b) };
  return rgbToHex(mixed);
}

function drawScaledCircle(
  ctx: RenderContext,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  mode: 'fill' | 'stroke',
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(radiusX, radiusY);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  if (mode === 'fill') {
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function fillEllipse(
  ctx: RenderContext,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
) {
  drawScaledCircle(ctx, centerX, centerY, radiusX, radiusY, 'fill');
}

function strokeEllipse(
  ctx: RenderContext,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
) {
  drawScaledCircle(ctx, centerX, centerY, radiusX, radiusY, 'stroke');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function detailCount(p: number, density = 1): number {
  return Math.max(1, Math.floor((p / 4) * density));
}

function pickOffset(
  tileSize: number,
  featureSize: number,
  randomValue: number,
) {
  const span = Math.max(0, tileSize - featureSize);
  if (span <= 0) return 0;
  return Math.floor(randomValue * span);
}

type BiomeCategory =
  | 'water'
  | 'forest'
  | 'grass'
  | 'desert'
  | 'swamp'
  | 'mountain'
  | 'volcanic'
  | 'default';

function classifyBiome(name: string): BiomeCategory {
  const upper = name.toUpperCase();
  if (upper.includes('OCEAN') || upper === 'LAKE' || upper === 'RIVER') {
    return 'water';
  }
  if (upper === 'FOREST' || upper === 'JUNGLE' || upper === 'TAIGA') {
    return 'forest';
  }
  if (upper === 'GRASSLAND' || upper === 'SAVANNA') {
    return 'grass';
  }
  if (upper === 'DESERT' || upper === 'BEACH') {
    return 'desert';
  }
  if (upper === 'SWAMP') {
    return 'swamp';
  }
  if (
    upper.includes('MOUNTAIN') ||
    upper === 'HILLS' ||
    upper === 'ALPINE' ||
    upper === 'TUNDRA'
  ) {
    return 'mountain';
  }
  if (upper === 'VOLCANIC') {
    return 'volcanic';
  }
  return 'default';
}

function drawWaterDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  const crest = lightenDarken(biomeColor, 0.2);
  const foam = lightenDarken(biomeColor, 0.35);
  const count = detailCount(p, 1.2);
  for (let i = 0; i < count; i++) {
    const salt = 500 + i * 31;
    const lenRand = rand01(worldX, worldY, seed, salt);
    const waveLength = Math.max(
      2,
      Math.min(p, Math.floor(p * (0.45 + lenRand * 0.4))),
    );
    const thickness = Math.max(1, Math.floor(p / 9));
    const offsetX =
      pixelX +
      pickOffset(p, waveLength, rand01(worldX, worldY, seed, salt + 11));
    const offsetY =
      pixelY +
      pickOffset(p, thickness, rand01(worldX, worldY, seed, salt + 19));
    const crestBend =
      (rand01(worldX, worldY, seed, salt + 23) - 0.5) * thickness;
    ctx.strokeStyle = i % 2 === 0 ? crest : foam;
    ctx.lineWidth = Math.max(1, thickness - 1);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + thickness / 2);
    ctx.quadraticCurveTo(
      offsetX + waveLength / 2,
      offsetY + crestBend,
      offsetX + waveLength,
      offsetY + thickness / 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawForestDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  const canopy = lightenDarken(biomeColor, -0.18);
  const canopyAlt = lightenDarken(biomeColor, -0.3);
  const trunk = '#2e1b0f';
  const count = detailCount(p, 1.4);
  for (let i = 0; i < count; i++) {
    const salt = 700 + i * 17;
    const sizeRand = rand01(worldX, worldY, seed, salt);
    const size = Math.max(
      2,
      Math.min(p - 1, Math.floor(p * (0.45 + sizeRand * 0.4))),
    );
    const offsetX =
      pixelX + pickOffset(p, size, rand01(worldX, worldY, seed, salt + 13));
    const offsetY =
      pixelY + pickOffset(p, size, rand01(worldX, worldY, seed, salt + 29));
    const trunkWidth = Math.max(1, Math.floor(size / 5));
    const trunkHeight = Math.max(1, Math.floor(size / 2));
    const trunkX = offsetX + Math.floor((size - trunkWidth) / 2);
    const trunkY = offsetY + size - trunkHeight;
    ctx.fillStyle = trunk;
    ctx.fillRect(trunkX, trunkY, trunkWidth, trunkHeight);
    ctx.fillStyle = i % 2 === 0 ? canopy : canopyAlt;
    ctx.beginPath();
    ctx.moveTo(offsetX + size / 2, offsetY);
    ctx.lineTo(offsetX + size, trunkY + 1);
    ctx.lineTo(offsetX, trunkY + 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawGrassDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  ctx.strokeStyle = lightenDarken(biomeColor, 0.18);
  const count = detailCount(p, 1.8);
  for (let i = 0; i < count; i++) {
    const salt = 900 + i * 13;
    const bladeLen = Math.max(
      2,
      Math.floor(p * (0.3 + rand01(worldX, worldY, seed, salt) * 0.4)),
    );
    const baseX =
      pixelX +
      pickOffset(
        p,
        Math.max(1, Math.floor(bladeLen / 2)),
        rand01(worldX, worldY, seed, salt + 7),
      );
    const baseY =
      pixelY + pickOffset(p, bladeLen, rand01(worldX, worldY, seed, salt + 19));
    const bend = (rand01(worldX, worldY, seed, salt + 23) - 0.5) * 0.8;
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, Math.floor(p / 12));
    ctx.moveTo(baseX, baseY + bladeLen);
    ctx.lineTo(
      baseX + Math.sin(bend) * bladeLen,
      baseY + bladeLen - Math.cos(bend) * bladeLen,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawDesertDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  const crest = lightenDarken(biomeColor, 0.1);
  const shadow = lightenDarken(biomeColor, -0.08);
  const count = detailCount(p, 1.3);
  for (let i = 0; i < count; i++) {
    const salt = 1100 + i * 19;
    const length = Math.max(
      2,
      Math.floor(p * (0.5 + rand01(worldX, worldY, seed, salt) * 0.4)),
    );
    const width = Math.max(1, Math.floor(p / 9));
    const offsetX =
      pixelX + pickOffset(p, length, rand01(worldX, worldY, seed, salt + 11));
    const offsetY =
      pixelY + pickOffset(p, width, rand01(worldX, worldY, seed, salt + 17));
    ctx.strokeStyle = crest;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + width / 2);
    ctx.quadraticCurveTo(
      offsetX + length / 2,
      offsetY + width,
      offsetX + length,
      offsetY + width / 2,
    );
    ctx.stroke();
    if (p >= 6) {
      ctx.strokeStyle = shadow;
      ctx.lineWidth = Math.max(1, Math.floor(p / 12));
      ctx.beginPath();
      ctx.moveTo(offsetX + length * 0.3, offsetY + width / 2);
      ctx.lineTo(offsetX + length * 0.3, offsetY + width);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSwampDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  const count = detailCount(p, 1.2);
  for (let i = 0; i < count; i++) {
    const salt = 1300 + i * 23;
    const radius = Math.max(
      1,
      Math.floor(p * (0.15 + rand01(worldX, worldY, seed, salt) * 0.15)),
    );
    const offsetX =
      pixelX +
      pickOffset(p, radius * 2, rand01(worldX, worldY, seed, salt + 13)) +
      radius;
    const offsetY =
      pixelY +
      pickOffset(p, radius * 2, rand01(worldX, worldY, seed, salt + 19)) +
      radius;
    const radiusY = radius * 0.6;
    ctx.fillStyle = lightenDarken(biomeColor, -0.18);
    fillEllipse(ctx, offsetX, offsetY, radius, radiusY);
    ctx.strokeStyle = lightenDarken(biomeColor, 0.12);
    ctx.lineWidth = Math.max(1, Math.floor(p / 14));
    strokeEllipse(ctx, offsetX, offsetY, radius, radiusY);
  }
  ctx.restore();
}

function drawMountainDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  const highlight = lightenDarken(biomeColor, 0.18);
  const shadow = lightenDarken(biomeColor, -0.2);
  const count = detailCount(p, 1.1);
  for (let i = 0; i < count; i++) {
    const salt = 1500 + i * 27;
    const size = Math.max(
      2,
      Math.floor(p * (0.5 + rand01(worldX, worldY, seed, salt) * 0.3)),
    );
    const offsetX =
      pixelX + pickOffset(p, size, rand01(worldX, worldY, seed, salt + 11));
    const offsetY =
      pixelY + pickOffset(p, size, rand01(worldX, worldY, seed, salt + 17));
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + size);
    ctx.lineTo(offsetX + size / 2, offsetY);
    ctx.lineTo(offsetX + size, offsetY + size);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.moveTo(offsetX + size / 2, offsetY);
    ctx.lineTo(offsetX + size, offsetY + size);
    ctx.lineTo(offsetX + size / 2, offsetY + size);
    ctx.closePath();
    ctx.fill();

    if (biomeColor === '#e2e1de' || biomeColor === '#a8a8fd') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const capHeight = Math.max(1, Math.floor(size / 3));
      ctx.fillRect(offsetX + size / 4, offsetY, size / 2, capHeight);
    }
  }
  ctx.restore();
}

function drawVolcanicDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biomeColor: string,
  worldX: number,
  worldY: number,
  seed: number,
) {
  ctx.save();
  const lava = mix('#ff5f2b', '#ffd966', 0.4);
  const ash = lightenDarken(biomeColor, -0.25);
  const count = detailCount(p, 1.2);
  for (let i = 0; i < count; i++) {
    const salt = 1700 + i * 21;
    const length = Math.max(
      2,
      Math.floor(p * (0.5 + rand01(worldX, worldY, seed, salt) * 0.3)),
    );
    const offsetX =
      pixelX + pickOffset(p, length, rand01(worldX, worldY, seed, salt + 9));
    const offsetY =
      pixelY +
      pickOffset(
        p,
        Math.max(1, Math.floor(p / 2)),
        rand01(worldX, worldY, seed, salt + 13),
      );
    const bend = Math.floor(
      (rand01(worldX, worldY, seed, salt + 17) - 0.5) * length * 0.6,
    );
    ctx.strokeStyle = ash;
    ctx.lineWidth = Math.max(1, Math.floor(p / 9));
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + length, offsetY + bend);
    ctx.stroke();

    ctx.strokeStyle = lava;
    ctx.lineWidth = Math.max(1, Math.floor(p / 12));
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + length * 0.7, offsetY + bend * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBiomeDetails(
  ctx: RenderContext,
  pixelX: number,
  pixelY: number,
  p: number,
  biome: (typeof BIOMES)[keyof typeof BIOMES],
  worldX: number,
  worldY: number,
  seed: number,
) {
  if (p < 5) return;
  const category = classifyBiome(biome.name);
  switch (category) {
    case 'water':
      drawWaterDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    case 'forest':
      drawForestDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    case 'grass':
      drawGrassDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    case 'desert':
      drawDesertDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    case 'swamp':
      drawSwampDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    case 'mountain':
      drawMountainDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    case 'volcanic':
      drawVolcanicDetails(
        ctx,
        pixelX,
        pixelY,
        p,
        biome.color,
        worldX,
        worldY,
        seed,
      );
      break;
    default:
      break;
  }
}

// Drawing helpers
export function drawBiomeTile(
  ctx: RenderContext,
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

  drawBiomeDetails(ctx, pixelX, pixelY, p, biome, worldX, worldY, seed);
}

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
