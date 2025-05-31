
import express from 'express';
import { PrismaClient } from '@prisma/client';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
const prisma = new PrismaClient();

// Middleware to parse JSON bodies
app.use(express.json());

// --- World Seeding ---
// POST /seed-world: Seed a simple 5x5 town in a valley
app.post('/seed-world', async (req, res) => {
  try {
    // Create or find the "Valley" biome
    let biome = await prisma.biome.findFirst({ where: { name: 'Valley' } });
    if (!biome) {
      biome = await prisma.biome.create({ data: { name: 'Valley', description: 'A lush valley with a small town.' } });
    }
    // Create 5x5 grid at z=0
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const desc = (x === 2 && y === 2)
          ? 'The town square, bustling with activity.'
          : 'A quiet part of the small valley town.';
        await prisma.worldTile.upsert({
          where: { x_y_z: { x, y, z: 0 } },
          update: {},
          create: { x, y, z: 0, biomeId: biome.id, description: desc },
        });
      }
    }
    res.json({ status: 'world seeded' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed world' });
  }
});

// --- Player Creation ---
// POST /players { slackId, name }
app.post('/players', async (req, res) => {
  const { slackId, name } = req.body;
  if (!slackId || !name) return res.status(400).json({ error: 'Missing slackId or name' });
  try {
    // Start at (2,2,0) (town square)
    const tile = await prisma.worldTile.findUnique({ where: { x_y_z: { x: 2, y: 2, z: 0 } } });
    if (!tile) return res.status(400).json({ error: 'World not seeded' });
    const player = await prisma.player.create({
      data: {
        slackId,
        name,
        x: 2,
        y: 2,
        z: 0,
        hp: 10,
        worldTileId: tile.id,
      },
    });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// --- Player Movement ---
// POST /players/:id/move { direction }
app.post('/players/:id/move', async (req, res) => {
  const { id } = req.params;
  const { direction } = req.body;
  const directions: Record<string, [number, number, number]> = {
    n: [0, 1, 0],
    s: [0, -1, 0],
    e: [1, 0, 0],
    w: [-1, 0, 0],
    up: [0, 0, 1],
    down: [0, 0, -1],
  };
  if (!directions[direction]) return res.status(400).json({ error: 'Invalid direction' });
  try {
    const player = await prisma.player.findUnique({ where: { id: Number(id) } });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const [dx, dy, dz] = directions[direction];
    const nx = player.x + dx;
    const ny = player.y + dy;
    const nz = player.z + dz;
    // Check if tile exists
    const tile = await prisma.worldTile.findUnique({ where: { x_y_z: { x: nx, y: ny, z: nz } } });
    if (!tile) return res.status(400).json({ error: 'Cannot move there' });
    const updated = await prisma.player.update({
      where: { id: player.id },
      data: { x: nx, y: ny, z: nz, worldTileId: tile.id },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to move player' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Demo: List all players
app.get('/players', async (req, res) => {
  const players = await prisma.player.findMany();
  res.json(players);
});


// Helper: get or create singleton GameState
async function getOrCreateGameState(prisma: PrismaClient) {
  let state = await prisma.gameState.findFirst();
  if (!state) {
    state = await prisma.gameState.create({ data: {} });
  }
  return state;
}

// Helper: get or create singleton WeatherState
async function getOrCreateWeatherState(prisma: PrismaClient) {
  let weather = await prisma.weatherState.findFirst();
  if (!weather) {
    weather = await prisma.weatherState.create({ data: { state: 'clear', pressure: 0 } });
  }
  return weather;
}

// Tick endpoint: called by tick service every 30 seconds
app.post('/tick', async (req, res) => {
  try {
    // Advance game time
    let state = await getOrCreateGameState(prisma);
    let tick = state.tick + 1;
    let gameHour = state.gameHour + 1;
    let gameDay = state.gameDay;
    if (gameHour >= 24) {
      gameHour = 0;
      gameDay += 1;
    }
    state = await prisma.gameState.update({
      where: { id: state.id },
      data: { tick, gameHour, gameDay },
    });

    // Update weather
    let weather = await getOrCreateWeatherState(prisma);
    // Pressure mechanic: increase pressure, random chance to change weather
    let pressure = weather.pressure + Math.floor(Math.random() * 3) + 1; // +1 to +3
    let stateOptions = ['clear', 'cloudy', 'overcast', 'raining', 'lightning'];
    let newWeather = weather.state;
    if (pressure > 10 && Math.random() < 0.3) {
      // Change weather
      let idx = stateOptions.indexOf(weather.state);
      let nextIdx = idx + (Math.random() < 0.5 ? 1 : -1);
      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx >= stateOptions.length) nextIdx = stateOptions.length - 1;
      newWeather = stateOptions[nextIdx];
      pressure = 0;
    }
    weather = await prisma.weatherState.update({
      where: { id: weather.id },
      data: { state: newWeather, pressure },
    });

    console.log(`[tick] Tick ${tick}, Day ${gameDay}, Hour ${gameHour}, Weather: ${newWeather}`);
    res.json({ status: 'tick processed', tick, gameDay, gameHour, weather: newWeather });
  } catch (err) {
    console.error('[tick] Error:', err);
    res.status(500).json({ error: 'Tick failed' });
  }
});

// State endpoint: get current game state
app.get('/state', async (req, res) => {
  try {
    const state = await getOrCreateGameState(prisma);
    const weather = await getOrCreateWeatherState(prisma);
    res.json({
      tick: state.tick,
      gameDay: state.gameDay,
      gameHour: state.gameHour,
      weather: weather.state,
      weatherPressure: weather.pressure,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get state' });
  }
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
