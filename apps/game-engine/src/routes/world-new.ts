import { Router } from 'express';
import { worldService } from '../services/world';
import axios from 'axios';

const router = Router();

// Reset world: proxy to world service
router.post('/reset', async (req, res) => {
  try {
    await worldService.resetWorld();
    console.log('[world] All tiles deleted via world service.');
    return res.json({ success: true });
  } catch (err) {
    console.error('[world] Error deleting tiles:', err);
    return res.status(500).json({ error: 'Failed to reset world' });
  }
});

// GET /world/grid - Get grid from world service
router.get('/grid', async (req, res) => {
  const size = req.query.size ? Number(req.query.size) : 11;
  const centerX = req.query.centerX ? Number(req.query.centerX) : 0;
  const centerY = req.query.centerY ? Number(req.query.centerY) : 0;
  
  try {
    // Proxy to the world service
    const response = await axios.get(`http://localhost:3001/world/grid?size=${size}&centerX=${centerX}&centerY=${centerY}`);
    res.type('text/plain').send(response.data);
  } catch (error) {
    console.error('[world] Error getting grid:', error);
    res.status(500).json({ error: 'Failed to get world grid' });
  }
});

// World seeding: proxy to world service
router.post('/seed', async (req, res) => {
  try {
    await worldService.seedWorld();
    return res.json({ status: 'world seeded via world service' });
  } catch (error) {
    console.error('[world] Error seeding world:', error);
    return res.status(500).json({ error: 'Failed to seed world' });
  }
});

export default router;
