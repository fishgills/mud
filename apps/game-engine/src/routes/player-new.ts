import { Router } from 'express';
import prisma from '../prisma';
import { getPlayerLocationInfo } from '../logic/player';
import { worldService } from '../services/world';

const router = Router();

// Player creation
router.post('/', async (req, res) => {
  const { slackId, name } = req.body;
  if (!slackId || !name) {
    return res.status(400).json({ error: 'Missing slackId or name' });
  }
  try {
    // Start at (2,2) (town square) - ensure it exists in world service
    await worldService.getTile(2, 2);
    
    // Find the corresponding tile in our database
    const dbTile = await prisma.worldTile.findUnique({ where: { x_y: { x: 2, y: 2 } } });
    if (!dbTile) {
      return res.status(400).json({ error: 'World not seeded' });
    }
    
    const player = await prisma.player.create({
      data: {
        slackId,
        name,
        x: 2,
        y: 2,
        hp: 10,
        worldTileId: dbTile.id,
      },
    });
    console.log(`[player] Created: id=${player.id}, name=${player.name}, slackId=${player.slackId}`);
    return res.json(player);
  } catch (err) {
    console.error('[player] Error creating player:', err);
    return res.status(500).json({ error: 'Failed to create player' });
  }
});

// POST /players/:id/generate-grid
// Generate tiles around player for testing
router.post('/:id/generate-grid', async (req, res) => {
  const { id } = req.params;
  const player = await prisma.player.findUnique({ where: { id: Number(id) } });
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }
  
  try {
    // Use world service to generate a grid around the player
    const tiles = await worldService.generateGrid(player.x, player.y, 5);
    console.log(`[player] Generated ${tiles.length} tiles around player ${player.name} at (${player.x}, ${player.y})`);
    res.json({ status: 'done', tilesGenerated: tiles.length });
  } catch (error) {
    console.error('[player] Error generating grid:', error);
    res.status(500).json({ error: 'Failed to generate grid' });
  }
});

// Player location info
router.get('/:id/location', async (req, res) => {
  const { id } = req.params;
  try {
    const info = await getPlayerLocationInfo(Number(id));
    return res.json(info);
  } catch (err) {
    console.error('[player] Error getting location info:', err);
    return res.status(500).json({ error: 'Failed to get location info' });
  }
});

// Player movement endpoints
router.post('/:id/move/:direction', async (req, res) => {
  const { id, direction } = req.params;
  try {
    const success = await movePlayerSimple(id, direction);
    if (success) {
      const info = await getPlayerLocationInfo(Number(id));
      return res.json({ success: true, location: info });
    } else {
      return res.status(400).json({ error: 'Invalid move' });
    }
  } catch (err) {
    console.error('[player] Error moving player:', err);
    return res.status(500).json({ error: 'Failed to move player' });
  }
});

// Simplified player movement using world service
async function movePlayerSimple(id: string, direction: string): Promise<boolean> {
  const directions: Record<string, [number, number]> = {
    n: [0, 1],
    s: [0, -1],
    e: [1, 0],
    w: [-1, 0],
  };
  
  if (!directions[direction]) return false;
  
  try {
    const player = await prisma.player.findUnique({ where: { id: Number(id) } });
    if (!player) return false;
    
    const [dx, dy] = directions[direction];
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // Get the tile from world service (this will generate it if it doesn't exist)
    const worldTile = await worldService.getTile(newX, newY);
    
    // Check if the tile exists in our local database, if not we need to sync it
    let dbTile = await prisma.worldTile.findUnique({ where: { x_y: { x: newX, y: newY } } });
    
    if (!dbTile) {
      // The world service generated a tile but it hasn't been synced to our DB yet
      // For now, let's create a placeholder tile (in a real implementation, you might want to sync from world service)
      const biome = await prisma.biome.findFirst();
      if (!biome) return false;
      
      dbTile = await prisma.worldTile.create({
        data: {
          x: newX,
          y: newY,
          biomeId: worldTile.biomeId,
          description: worldTile.description,
          biomeMix: worldTile.biomeMix,
        },
      });
    }
    
    // Update player position
    await prisma.player.update({
      where: { id: player.id },
      data: { 
        x: newX, 
        y: newY, 
        worldTileId: dbTile.id 
      },
    });
    
    console.log(`[player] Move: id=${player.id}, name=${player.name}, from=(${player.x},${player.y}) to=(${newX},${newY})`);
    return true;
  } catch (err) {
    console.error('[player] Error in simple move:', err);
    return false;
  }
}

export default router;
