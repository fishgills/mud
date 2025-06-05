import express from 'express';
const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

import { getTile, getChunk } from './services/chunkService';
import { findNearbyBiomes } from './utils/biomeUtils';

app.use(express.json());

// Endpoint: Get a single tile's info
app.get('/tile/:x/:y', async (req, res) => {
  const x = parseInt(req.params.x, 10);
  const y = parseInt(req.params.y, 10);
  try {
    const tile = await getTile(x, y);
    // Find nearby biomes in a 5-tile radius
    const chunk = await getChunk(Math.floor(x / 50), Math.floor(y / 50));
    const flatTiles = chunk.flat();
    const nearby = findNearbyBiomes(flatTiles, tile, 5);
    res.json({
      ...tile,
      nearbyBiomes: nearby,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tile', details: err });
  }
});

// Endpoint: Get a chunk as a 2D array of tiles
app.get('/chunk/:chunkX/:chunkY', async (req, res) => {
  const chunkX = parseInt(req.params.chunkX, 10);
  const chunkY = parseInt(req.params.chunkY, 10);
  try {
    const chunk = await getChunk(chunkX, chunkY);
    res.json(chunk);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get chunk', details: err });
  }
});
app.listen(port, host, () => {
  console.log(`World generation service running at http://${host}:${port}`);
});
