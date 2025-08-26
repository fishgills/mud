import axios from 'axios';

// DM GraphQL endpoint for processTick mutation
const DM_GRAPHQL_URL =
  process.env.DM_GRAPHQL_URL || 'http://localhost:3000/graphql';

// GraphQL mutation for processing a tick
const PROCESS_TICK_MUTATION = `mutation {  processTick {    success    message    result {      tick      gameHour      gameDay      monstersSpawned      monstersMoved      combatEvents      weatherUpdated    }   } }`;

async function sendProcessTick() {
  try {
    const response = await axios.post(
      DM_GRAPHQL_URL,
      { query: PROCESS_TICK_MUTATION, variables: {} },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
    const payload = response.data;
    const result = payload?.data?.processTick;
    if (result?.success) {
      console.log(`[tick] DM processTick OK: ${result.message ?? 'success'}`);
      console.log(`[tick] Result: ${JSON.stringify(result.result, null, 2)}`);
    } else {
      console.warn(
        `[tick] DM processTick returned failure: ${result?.message ?? 'unknown error'}`,
      );
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        '[tick] Error calling DM GraphQL:',
        err.message,
        err.response?.data ?? '',
      );
    } else if (err instanceof Error) {
      console.error('[tick] Error calling DM GraphQL:', err.message);
    } else {
      console.error('[tick] Error calling DM GraphQL:', err);
    }
  }
}

// Start loop
console.log('[tick] service starting — targeting DM at', DM_GRAPHQL_URL);
// Kick one immediately on startup (optional)
sendProcessTick().catch(() => void 0);
// Then every 30 seconds
const interval: NodeJS.Timeout = setInterval(sendProcessTick, 30 * 1000);

// Graceful shutdown
function cleanup(code?: number) {
  try {
    clearInterval(interval);
  } finally {
    if (typeof code === 'number') process.exit(code);
  }
}

process.on('SIGINT', () => {
  console.log('[tick] received SIGINT — shutting down');
  cleanup(0);
});
process.on('SIGTERM', () => {
  console.log('[tick] received SIGTERM — shutting down');
  cleanup(0);
});
