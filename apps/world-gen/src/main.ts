import express from 'express';
import { worldService } from './services/world-service';
import { logger } from './utils/logger';

const app = express();
app.use(express.json());

// Initialize world service
worldService.initialize();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get chunk endpoint - generates/retrieves a 50x50 chunk
app.get('/chunk/:chunkX/:chunkY', async (req, res) => {
  try {
    const { chunkX, chunkY } = req.params;
    const chunk = await worldService.getChunk(
      parseInt(chunkX),
      parseInt(chunkY)
    );
    res.json(chunk);
  } catch (error) {
    logger.error('Error getting chunk:', error);
    res.status(500).json({ error: 'Failed to get chunk' });
  }
});

// Get single tile endpoint
app.get('/tile/:x/:y', async (req, res) => {
  try {
    const { x, y } = req.params;
    const tile = await worldService.getTileWithNearbyBiomes(
      parseInt(x),
      parseInt(y)
    );
    res.json(tile);
  } catch (error) {
    logger.error('Error getting tile:', error);
    res.status(500).json({ error: 'Failed to get tile' });
  }
});

// Render map endpoint - generates a 2D image of the currently generated map
app.get('/render', async (req, res) => {
  try {
    const { minX, maxX, minY, maxY } = req.query;
    const imageBuffer = await worldService.renderMap(
      minX ? parseInt(minX as string) : -100,
      maxX ? parseInt(maxX as string) : 100,
      minY ? parseInt(minY as string) : -100,
      maxY ? parseInt(maxY as string) : 100
    );
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (error) {
    logger.error('Error rendering map:', error);
    res.status(500).json({ error: 'Failed to render map' });
  }
});

// Render ASCII map endpoint - generates a text-based map of the currently generated map
app.get('/render/ascii', async (req, res) => {
  try {
    const { minX, maxX, minY, maxY } = req.query;
    const asciiMap = await worldService.renderMapAscii(
      minX ? parseInt(minX as string) : -50,
      maxX ? parseInt(maxX as string) : 50,
      minY ? parseInt(minY as string) : -50,
      maxY ? parseInt(maxY as string) : 50
    );
    res.setHeader('Content-Type', 'text/plain');
    res.send(asciiMap);
  } catch (error) {
    logger.error('Error rendering ASCII map:', error);
    res.status(500).json({ error: 'Failed to render ASCII map' });
  }
});

// Statistics endpoint
app.get('/stats', async (req, res) => {
  try {
    const stats = await worldService.getStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`World Gen service listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await worldService.shutdown();
  process.exit(0);
});
