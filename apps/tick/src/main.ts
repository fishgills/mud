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
        {
          status: res.status,
          body: text.slice(0, 500),
        },
        'Active player lookup failed',
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
      {
        error: err instanceof Error ? err.message : err,
      },
      'Error checking active players',
    );
    return false;
  }
}

async function sendProcessTick() {
  // First check if there are any active players
  const hasActive = await hasActivePlayers();
  if (!hasActive) {
    console.info(
      {
        activityThresholdMinutes: ACTIVITY_THRESHOLD_MINUTES,
      },
      'No active players, skipping tick',
    );
    return;
  }

  console.info('Active players detected, processing tick');
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
        {
          status: res.status,
          statusText: res.statusText,
          body: text.slice(0, 1000),
        },
        'DM processTick failed',
      );
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      console.error({ error: e }, 'Failed to parse DM response as JSON');
      return;
    }
    const result = payload as {
      success?: boolean;
      message?: string;
      result?: Record<string, unknown>;
    };
    if (result.success) {
      console.info(
        {
          message: result.message ?? 'success',
          result: result.result,
        },
        'DM processTick succeeded',
      );
    } else {
      console.warn(
        {
          message: result?.message ?? 'unknown error',
        },
        'DM processTick returned failure',
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error({ error: err.message }, 'Error calling DM processTick');
    } else {
      console.error({ error: err }, 'Error calling DM processTick');
    }
  }
}

// Start loop and lightweight HTTP server for platform health/readiness checks
console.info(
  {
    dmBaseUrl: DM_API_BASE_URL,
    tickIntervalMs: TICK_INTERVAL_MS,
    activityThresholdMinutes: ACTIVITY_THRESHOLD_MINUTES,
  },
  'Tick service starting',
);
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
    console.debug({ url: req.url, method: req.method }, 'Health probe handled');
    return;
  }
  res.statusCode = 404;
  res.end('Not Found');
  console.debug(
    { url: req.url, method: req.method },
    'Unhandled request received',
  );
});
server.listen(PORT, '0.0.0.0', () => {
  console.info({ port: PORT, host: '0.0.0.0' }, 'HTTP health server listening');
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
  console.info('Received SIGINT, shutting down');
  cleanup(0);
});
process.on('SIGTERM', () => {
  console.info('Received SIGTERM, shutting down');
  cleanup(0);
});
