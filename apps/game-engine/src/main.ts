
import express from 'express';
import { PrismaClient } from '@prisma/client';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
const prisma = new PrismaClient();

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
