import http from 'http';
import { authorizedFetch } from '@mud/gcp-auth';

// DM GraphQL endpoint for processTick mutation
const DM_GRAPHQL_URL =
  process.env.DM_GRAPHQL_URL || 'http://localhost:3000/graphql';

// GraphQL mutation for processing a tick
const PROCESS_TICK_MUTATION = `mutation {  processTick {    success    message    result {      tick      gameHour      gameDay      monstersSpawned      monstersMoved      combatEvents      weatherUpdated    }   } }`;

async function sendProcessTick() {
  try {
    const res = await authorizedFetch(DM_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ query: PROCESS_TICK_MUTATION, variables: {} }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(
        `[tick] DM GraphQL HTTP ${res.status} ${res.statusText}: ${text.slice(0, 1000)}`,
      );
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      console.error('[tick] Failed to parse DM response as JSON:', e);
      return;
    }
    type ProcessTickPayload = {
      data?: {
        processTick?: {
          success: boolean;
          message?: string;
          result?: Record<string, unknown>;
        };
      };
    };
    const result = (payload as ProcessTickPayload).data?.processTick;
    if (result?.success) {
      console.log(`[tick] DM processTick OK: ${result.message ?? 'success'}`);
      console.log(`[tick] Result: ${JSON.stringify(result.result, null, 2)}`);
    } else {
      console.warn(
        `[tick] DM processTick returned failure: ${result?.message ?? 'unknown error'}`,
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('[tick] Error calling DM GraphQL:', err.message);
    } else {
      console.error('[tick] Error calling DM GraphQL:', err);
    }
  }
}

// Start loop and lightweight HTTP server for Cloud Run health/readiness
console.log('[tick] service starting — targeting DM at', DM_GRAPHQL_URL);
// Kick one immediately on startup (optional)
sendProcessTick().catch(() => void 0);
// Then every 30 seconds
const interval: NodeJS.Timeout = setInterval(sendProcessTick, 30 * 1000);

// Minimal HTTP server to satisfy Cloud Run's requirement to listen on $PORT
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }
  if (req.url === '/' || req.url.startsWith('/health')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.statusCode = 404;
  res.end('Not Found');
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[tick] HTTP health server listening on 0.0.0.0:${PORT}`);
});

// Graceful shutdown
function cleanup(code?: number) {
  try {
    clearInterval(interval);
    server.close();
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
