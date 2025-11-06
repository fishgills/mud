import '@mud/tracer/register';

import http from 'http';
import { createLogger } from '@mud/logging';

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

const log = createLogger('tick');
const httpLog = createLogger('tick:http');

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
      log.error('Active player lookup failed', {
        status: res.status,
        body: text.slice(0, 500),
      });
      return false;
    }
    const payload = JSON.parse(text) as {
      success?: boolean;
      active?: boolean;
      minutesThreshold?: number;
    };
    return payload.active ?? false;
  } catch (err) {
    log.error('Error checking active players', {
      error: err instanceof Error ? err.message : err,
    });
    return false;
  }
}

async function sendProcessTick() {
  // First check if there are any active players
  const hasActive = await hasActivePlayers();
  if (!hasActive) {
    log.info('No active players, skipping tick', {
      activityThresholdMinutes: ACTIVITY_THRESHOLD_MINUTES,
    });
    return;
  }

  log.info('Active players detected, processing tick');
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
      log.error('DM processTick failed', {
        status: res.status,
        statusText: res.statusText,
        body: text.slice(0, 1000),
      });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      log.error('Failed to parse DM response as JSON', { error: e });
      return;
    }
    const result = payload as {
      success?: boolean;
      message?: string;
      result?: Record<string, unknown>;
    };
    if (result.success) {
      log.info('DM processTick succeeded', {
        message: result.message ?? 'success',
        result: result.result,
      });
    } else {
      log.warn('DM processTick returned failure', {
        message: result?.message ?? 'unknown error',
      });
    }
  } catch (err) {
    if (err instanceof Error) {
      log.error('Error calling DM processTick', { error: err.message });
    } else {
      log.error('Error calling DM processTick', { error: err });
    }
  }
}

// Start loop and lightweight HTTP server for platform health/readiness checks
log.info('Tick service starting', {
  dmBaseUrl: DM_API_BASE_URL,
  tickIntervalMs: TICK_INTERVAL_MS,
  activityThresholdMinutes: ACTIVITY_THRESHOLD_MINUTES,
});
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
    httpLog.debug('Health probe', { url: req.url, method: req.method });
    return;
  }
  res.statusCode = 404;
  res.end('Not Found');
  httpLog.debug('Unhandled request', { url: req.url, method: req.method });
});
server.listen(PORT, '0.0.0.0', () => {
  log.info('HTTP health server listening', { port: PORT, host: '0.0.0.0' });
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
  log.info('Received SIGINT, shutting down');
  cleanup(0);
});
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down');
  cleanup(0);
});
