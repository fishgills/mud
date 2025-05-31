import { Router } from 'express';
import prisma from '../prisma';

// Helper: get or create singleton GameState
async function getOrCreateGameState() {
  let state = await prisma.gameState.findFirst();
  if (!state) {
    state = await prisma.gameState.create({ data: {} });
  }
  return state;
}

// Helper: get or create singleton WeatherState
async function getOrCreateWeatherState() {
  let weather = await prisma.weatherState.findFirst();
  if (!weather) {
    weather = await prisma.weatherState.create({ data: { state: 'clear', pressure: 0 } });
  }
  return weather;
}

const router = Router();

// Tick endpoint
router.post('/tick', async (req, res) => {
  try {
    let state = await getOrCreateGameState();
    const tick = state.tick + 1;
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
    let weather = await getOrCreateWeatherState();
    let pressure = weather.pressure + Math.floor(Math.random() * 3) + 1;
    const stateOptions = ['clear', 'cloudy', 'overcast', 'raining', 'lightning'];
    let newWeather = weather.state;
    if (pressure > 10 && Math.random() < 0.3) {
      const idx = stateOptions.indexOf(weather.state);
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
    return res.json({ status: 'tick processed', tick, gameDay, gameHour, weather: newWeather });
  } catch (err) {
    console.error('[tick] Error:', err);
    return res.status(500).json({ error: 'Tick failed' });
  }
});

// State endpoint
router.get('/state', async (req, res) => {
  try {
    const state = await getOrCreateGameState();
    const weather = await getOrCreateWeatherState();
    return res.json({
      tick: state.tick,
      gameDay: state.gameDay,
      gameHour: state.gameHour,
      weather: weather.state,
      weatherPressure: weather.pressure,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to get state' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
