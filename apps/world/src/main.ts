import express from 'express';
import worldRoutes from './routes/world';
import redis from './redis';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3001; // Different port from game-engine

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    // Quick Redis and database health check could be added here
    res.json({
      status: 'healthy',
      service: 'world-service',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Routes
app.use('/world', worldRoutes);

app.get('/', (req, res) => {
  res.send({
    message: 'World Service API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      tile: 'GET /world/tile/:x/:y',
      grid: 'POST /world/grid',
      gridView: 'GET /world/grid',
      chunk: 'GET /world/chunk/:chunkX/:chunkY',
      chunkInfo: 'GET /world/chunk-info/:x/:y',
      map: 'GET /world/map?centerX=0&centerY=0&width=100&height=100&pixelSize=2',
      mapColors: 'GET /world/map/colors',
      seed: 'POST /world/seed',
      reset: 'DELETE /world/reset',
    },
  });
});

async function startServer() {
  try {
    // Flush all Redis keys on startup
    await redis.flushall();
    console.log('[ redis ] Cache cleared on startup');
  } catch (err) {
    console.error('[ redis ] Failed to flush cache on startup:', err);
  }
  app.listen(port, host, () => {
    console.log(`[ ready ] World Service running at http://${host}:${port}`);
  });
}

startServer();
