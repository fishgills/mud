import express from 'express';
import axios from 'axios';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// Configure the game engine endpoint (adjust as needed)
const GAME_ENGINE_URL =
  process.env.GAME_ENGINE_URL || 'http://localhost:3002/tick';

const app = express();

app.get('/', (req, res) => {
  res.send({ message: 'Tick service running' });
});

// Tick loop: every 30 seconds, send a POST to the game engine
setInterval(async () => {
  try {
    const response = await axios.post(GAME_ENGINE_URL);
    console.log(`[tick] Sent tick to game engine:`, response.data);
  } catch (err) {
    if (err instanceof Error) {
      console.error('[tick] Error sending tick:', err.message);
    } else {
      console.error('[tick] Error sending tick:', err);
    }
  }
}, 30 * 1000);

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
