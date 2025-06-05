import { Router } from 'express';
import {
  generateTile,
  generateTileGrid,
  generateChunk,
  worldToChunk,
  chunkToWorld,
} from '../logic/world';
import { seedBiomes } from '../logic/biome';
import {
  renderWorldMap,
  getBiomeColors,
  RenderMode,
} from '../logic/map-renderer';
import { BiomeRegistry } from '../logic/biome-definitions';
import { worldStructureService } from '../logic/world-structure-service';
import prisma from '../prisma';

const router = Router();

// GET /tile/:x/:y - Get or generate a single tile
router.get('/tile/:x/:y', async (req, res) => {
  try {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const tile = await generateTile(x, y);
    return res.json(tile);
  } catch (error) {
    console.error('Error generating tile:', error);
    return res.status(500).json({ error: 'Failed to generate tile' });
  }
});

// POST /grid - Generate a grid of tiles around a center point
router.post('/grid', async (req, res) => {
  try {
    const { centerX, centerY, radius = 5 } = req.body;

    if (typeof centerX !== 'number' || typeof centerY !== 'number') {
      return res
        .status(400)
        .json({ error: 'centerX and centerY must be numbers' });
    }

    if (radius > 10) {
      return res.status(400).json({ error: 'Maximum radius is 10' });
    }

    const tiles = await generateTileGrid(centerX, centerY, radius);
    return res.json({ tiles, count: tiles.length });
  } catch (error) {
    console.error('Error generating tile grid:', error);
    return res.status(500).json({ error: 'Failed to generate tile grid' });
  }
});

// GET /chunk/:chunkX/:chunkY - Generate or get a complete chunk (20x20 tiles)
router.get('/chunk/:chunkX/:chunkY', async (req, res) => {
  try {
    const chunkX = parseInt(req.params.chunkX);
    const chunkY = parseInt(req.params.chunkY);

    if (isNaN(chunkX) || isNaN(chunkY)) {
      return res.status(400).json({ error: 'Invalid chunk coordinates' });
    }

    const chunk = await generateChunk(chunkX, chunkY);
    return res.json(chunk);
  } catch (error) {
    console.error('Error generating chunk:', error);
    return res.status(500).json({ error: 'Failed to generate chunk' });
  }
});

// GET /chunk-info/:x/:y - Get chunk information for world coordinates
router.get('/chunk-info/:x/:y', async (req, res) => {
  try {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const chunkCoords = worldToChunk(x, y);
    const worldBounds = chunkToWorld(chunkCoords.chunkX, chunkCoords.chunkY);

    return res.json({
      worldCoordinates: { x, y },
      chunkCoordinates: chunkCoords,
      chunkWorldBounds: worldBounds,
    });
  } catch (error) {
    console.error('Error getting chunk info:', error);
    return res.status(500).json({ error: 'Failed to get chunk info' });
  }
});

// GET /grid - Get a text representation of the world grid
router.get('/grid', async (req, res) => {
  const size = req.query.size ? Number(req.query.size) : 11;
  const centerX = req.query.centerX ? Number(req.query.centerX) : 0;
  const centerY = req.query.centerY ? Number(req.query.centerY) : 0;

  const half = Math.floor(size / 2);

  // Get all tiles in the grid
  const tiles = await prisma.worldTile.findMany({
    where: {
      x: { gte: centerX - half, lte: centerX + half },
      y: { gte: centerY - half, lte: centerY + half },
    },
    include: { biome: true },
  });

  // Get biome letter mapping from the consolidated registry
  const biomeLetter = BiomeRegistry.getLetterMap();

  // Build a grid
  const grid: string[][] = [];
  for (let y = centerY + half; y >= centerY - half; y--) {
    const row: string[] = [];
    for (let x = centerX - half; x <= centerX + half; x++) {
      const tile = tiles.find((t) => t.x === x && t.y === y);
      if (tile && tile.biome) {
        row.push(biomeLetter[tile.biome.name] || '?');
      } else {
        row.push('.');
      }
    }
    grid.push(row);
  }

  // Join rows into a string
  const text = grid.map((row) => row.join(' ')).join('\n');
  res.type('text/plain').send(text);
});

// POST /seed - Seed the world with initial biomes and starter town
router.post('/seed', async (req, res) => {
  try {
    await seedBiomes();

    // (City biome and starting town creation removed)

    return res.json({ status: 'world seeded' });
  } catch (error) {
    console.error('Error seeding world:', error);
    return res.status(500).json({ error: 'Failed to seed world' });
  }
});

// DELETE /reset - Reset the world by deleting all tiles
router.delete('/reset', async (req, res) => {
  try {
    await prisma.worldTile.deleteMany({});
    console.log('[world] All tiles deleted.');
    return res.json({ success: true });
  } catch (error) {
    console.error('[world] Error deleting tiles:', error);
    return res.status(500).json({ error: 'Failed to reset world' });
  }
});

// GET /map - Generate a visual map image of the world
router.get('/map', async (req, res): Promise<void> => {
  try {
    const centerX = parseInt(req.query.centerX as string) || 0;
    const centerY = parseInt(req.query.centerY as string) || 0;
    const width = Math.min(parseInt(req.query.width as string) || 100, 10000); // Max 10000 to prevent overload
    const height = Math.min(parseInt(req.query.height as string) || 100, 10000); // Max 10000 to prevent overload
    const pixelSize = Math.max(
      1,
      Math.min(parseInt(req.query.pixelSize as string) || 2, 10)
    ); // 1-10 pixel size
    const useOptimized = req.query.optimized === 'true';

    // Parse render mode from query parameter
    const renderModeParam = req.query.renderMode as string;
    let renderMode: RenderMode = RenderMode.WORLD; // Default to world view

    if (
      renderModeParam &&
      Object.values(RenderMode).includes(renderModeParam as RenderMode)
    ) {
      renderMode = renderModeParam as RenderMode;
    }

    // Use optimized rendering for large areas or when explicitly requested
    const totalTiles = width * height;
    const shouldUseOptimized = useOptimized || totalTiles > 250000;

    const imageBuffer = await renderWorldMap({
      centerX,
      centerY,
      width,
      height,
      pixelSize,
      renderMode,
    });

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'X-Render-Method': shouldUseOptimized ? 'optimized' : 'standard',
      'X-Render-Mode': renderMode,
    });

    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating world map:', error);
    res.status(500).json({ error: 'Failed to generate world map' });
  }
});

// GET /map/colors - Get biome color mapping for reference
router.get('/map/colors', (req, res) => {
  const colors = getBiomeColors();
  res.json(colors);
});

// POST /region/structures - Generate settlements and landmarks for a region
router.post('/region/structures', async (req, res) => {
  try {
    const { centerX, centerY, width, height } = req.body;

    if (
      typeof centerX !== 'number' ||
      typeof centerY !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return res.status(400).json({
        error: 'centerX, centerY, width, and height must be numbers',
      });
    }

    if (width > 2000 || height > 2000) {
      return res.status(400).json({
        error: 'Maximum region size is 2000x2000',
      });
    }

    const region = { centerX, centerY, width, height };
    const structures = await worldStructureService.generateRegionStructures(
      region
    );

    return res.json({
      region,
      settlementsCount: structures.settlements.length,
      landmarksCount: structures.landmarks.length,
      settlements: structures.settlements,
      landmarks: structures.landmarks,
    });
  } catch (error) {
    console.error('Error generating region structures:', error);
    return res
      .status(500)
      .json({ error: 'Failed to generate region structures' });
  }
});

// GET /structure/:x/:y - Get settlement or landmark at specific coordinates
router.get('/structure/:x/:y', async (req, res) => {
  try {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const structure = await worldStructureService.getStructureAt(x, y);

    if (!structure) {
      return res.json({
        structure: null,
        message: 'No structure found at these coordinates',
      });
    }

    return res.json({ structure });
  } catch (error) {
    console.error('Error getting structure:', error);
    return res.status(500).json({ error: 'Failed to get structure' });
  }
});

// GET /settlements - Get all settlements in a region
router.get('/settlements', async (req, res) => {
  try {
    const { minX, maxX, minY, maxY } = req.query;

    const whereClause: any = {};
    if (minX)
      whereClause.x = { gte: parseInt(minX as string), ...whereClause.x };
    if (maxX)
      whereClause.x = { lte: parseInt(maxX as string), ...whereClause.x };
    if (minY)
      whereClause.y = { gte: parseInt(minY as string), ...whereClause.y };
    if (maxY)
      whereClause.y = { lte: parseInt(maxY as string), ...whereClause.y };

    const settlements = await prisma.settlement.findMany({
      where: whereClause,
      orderBy: [{ type: 'asc' }, { population: 'desc' }],
    });

    res.json({
      count: settlements.length,
      settlements: settlements.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        x: s.x,
        y: s.y,
        size: s.size,
        population: s.population,
        description: s.description,
      })),
    });
  } catch (error) {
    console.error('Error getting settlements:', error);
    res.status(500).json({ error: 'Failed to get settlements' });
  }
});

// GET /landmarks - Get all landmarks in a region
router.get('/landmarks', async (req, res) => {
  try {
    const { minX, maxX, minY, maxY } = req.query;

    const whereClause: any = {};
    if (minX)
      whereClause.x = { gte: parseInt(minX as string), ...whereClause.x };
    if (maxX)
      whereClause.x = { lte: parseInt(maxX as string), ...whereClause.x };
    if (minY)
      whereClause.y = { gte: parseInt(minY as string), ...whereClause.y };
    if (maxY)
      whereClause.y = { lte: parseInt(maxY as string), ...whereClause.y };

    const landmarks = await prisma.landmark.findMany({
      where: whereClause,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    res.json({
      count: landmarks.length,
      landmarks: landmarks.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        x: l.x,
        y: l.y,
        description: l.description,
      })),
    });
  } catch (error) {
    console.error('Error getting landmarks:', error);
    res.status(500).json({ error: 'Failed to get landmarks' });
  }
});

export default router;
