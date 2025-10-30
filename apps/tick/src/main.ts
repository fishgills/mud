import '@mud/tracer/register';

import http from 'http';

// Use global fetch in place of the removed @mud/gcp-auth helper
const authorizedFetch = globalThis.fetch as typeof fetch;

const DM_API_BASE_URL = process.env.DM_API_BASE_URL || 'http://localhost:3000';

// Tick interval in milliseconds (default: 60000 ms = 1 minute)
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '60000', 10);

// How many minutes to check for player activity (default: 30 minutes)
const ACTIVITY_THRESHOLD_MINUTES = parseInt(
  process.env.ACTIVITY_THRESHOLD_MINUTES || '30',
  10,
);

// auth logger removed (was setAuthLogger) — not needed on GKE

async function hasActivePlayers(): Promise<boolean> {
  try {
    const url = new URL(`${DM_API_BASE_URL}/system/active-players`);
    url.searchParams.set(
      'minutesThreshold',
      String(ACTIVITY_THRESHOLD_MINUTES),
    );
    const res = await authorizedFetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(
        `[tick] hasActivePlayers HTTP ${res.status}: ${text.slice(0, 500)}`,
      );
      return false;
    }
    const payload = JSON.parse(text) as {
      success?: boolean;
      active?: boolean;
      minutesThreshold?: number;
    };
    return payload.active ?? false;
  } catch (err) {
    console.error(
      '[tick] Error checking active players:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

async function sendProcessTick() {
  // First check if there are any active players
  const hasActive = await hasActivePlayers();
  if (!hasActive) {
    console.log(
      `[tick] No active players in last ${ACTIVITY_THRESHOLD_MINUTES} minutes, skipping tick`,
    );
    return;
  }

  console.log('[tick] Active players detected, processing tick...');
  try {
    const res = await authorizedFetch(
      `${DM_API_BASE_URL}/system/process-tick`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
        },
      },
    );
    const text = await res.text();
    if (!res.ok) {
      console.error(
        `[tick] DM API HTTP ${res.status} ${res.statusText}: ${text.slice(0, 1000)}`,
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
    const result = payload as {
      success?: boolean;
      message?: string;
      result?: Record<string, unknown>;
    };
    if (result.success) {
      console.log(`[tick] DM processTick OK: ${result.message ?? 'success'}`);
      console.log(`[tick] Result: ${JSON.stringify(result.result, null, 2)}`);
    } else {
      console.warn(
        `[tick] DM processTick returned failure: ${result?.message ?? 'unknown error'}`,
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('[tick] Error calling DM processTick:', err.message);
    } else {
      console.error('[tick] Error calling DM processTick:', err);
    }
  }
}

// Start loop and lightweight HTTP server for platform health/readiness checks
console.log('[tick] service starting — targeting DM at', DM_API_BASE_URL);
console.log(
  `[tick] Tick interval: ${TICK_INTERVAL_MS}ms (${TICK_INTERVAL_MS / 60000} minutes)`,
);
console.log(`[tick] Activity threshold: ${ACTIVITY_THRESHOLD_MINUTES} minutes`);
// Kick one immediately on startup (optional)
sendProcessTick().catch(() => void 0);
// Then every configured interval
const interval: NodeJS.Timeout = setInterval(sendProcessTick, TICK_INTERVAL_MS);

// Minimal HTTP server to satisfy hosting platform requirements to listen on $PORT
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
