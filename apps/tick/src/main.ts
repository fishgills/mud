import '@mud/tracer/register';

import http from 'http';
import { initClient } from '@ts-rest/core';
import {
  dmContract,
  type HasActivePlayersResponse,
  type ProcessTickResponse,
} from '@mud/api-contracts';
import { authorizedFetch, setAuthLogger } from '@mud/gcp-auth';

const normalizeBaseUrl = (urlStr: string): string => {
  if (!urlStr) {
    return 'http://localhost:3000';
  }
  try {
    const parsed = new URL(urlStr);
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.toString();
  } catch {
    return urlStr.replace(/\/$/, '');
  }
};

const DM_SERVICE_URL = normalizeBaseUrl(
  process.env.DM_SERVICE_URL ?? 'http://localhost:3000',
);

// Tick interval in milliseconds (default: 1 minute)
const TICK_INTERVAL_MS = Number.parseInt(
  process.env.TICK_INTERVAL_MS ?? '60000',
  10,
);

// How many minutes to check for player activity (default: 30 minutes)
const ACTIVITY_THRESHOLD_MINUTES = Number.parseInt(
  process.env.ACTIVITY_THRESHOLD_MINUTES ?? '30',
  10,
);

setAuthLogger({
  log: (...args: unknown[]) => console.log(String(args[0] ?? '')),
  warn: (...args: unknown[]) => console.warn(String(args[0] ?? '')),
  error: (...args: unknown[]) => console.error(String(args[0] ?? '')),
});

const dmClient = initClient(dmContract, {
  baseUrl: DM_SERVICE_URL,
  baseHeaders: {},
  fetch: authorizedFetch,
});

const unwrap = async <T>(
  request: Promise<{ status: number; body: T }>,
): Promise<T> => {
  const { status, body } = await request;
  if (status >= 400) {
    let message = `DM API request failed (HTTP ${status})`;
    const candidate = body as unknown;
    if (
      candidate &&
      typeof candidate === 'object' &&
      'message' in candidate &&
      typeof (candidate as { message?: unknown }).message === 'string'
    ) {
      const maybe = (candidate as { message: string }).message.trim();
      if (maybe.length > 0) {
        message = maybe;
      }
    }
    const error = new Error(message);
    (error as { status?: number }).status = status;
    (error as { responseBody?: unknown }).responseBody = body;
    throw error;
  }
  return body;
};

async function hasActivePlayers(): Promise<boolean> {
  try {
    const body = await unwrap<HasActivePlayersResponse>(
      dmClient.hasActivePlayers({
        query: { minutesThreshold: ACTIVITY_THRESHOLD_MINUTES },
      }),
    );
    return Boolean(body.hasActivePlayers);
  } catch (err) {
    console.error(
      '[tick] Error checking active players:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

async function sendProcessTick() {
  const hasActive = await hasActivePlayers();
  if (!hasActive) {
    console.log(
      `[tick] No active players in last ${ACTIVITY_THRESHOLD_MINUTES} minutes, skipping tick`,
    );
    return;
  }

  console.log('[tick] Active players detected, processing tick...');
  try {
    const body = await unwrap<ProcessTickResponse>(dmClient.processTick({}));
    if (body.success) {
      console.log(`[tick] DM processTick OK: ${body.message ?? 'success'}`);
      if (body.result) {
        console.log(`[tick] Result: ${JSON.stringify(body.result, null, 2)}`);
      }
    } else {
      console.warn(
        `[tick] DM processTick returned failure: ${body.message ?? 'unknown error'}`,
      );
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('[tick] Error calling DM service:', err.message);
    } else {
      console.error('[tick] Error calling DM service:', err);
    }
  }
}

// Start loop and lightweight HTTP server for Cloud Run health/readiness
console.log('[tick] service starting — targeting DM at', DM_SERVICE_URL);
console.log(
  `[tick] Tick interval: ${TICK_INTERVAL_MS}ms (${TICK_INTERVAL_MS / 60000} minutes)`,
);
console.log(`[tick] Activity threshold: ${ACTIVITY_THRESHOLD_MINUTES} minutes`);
sendProcessTick().catch(() => void 0);
const interval: NodeJS.Timeout = setInterval(sendProcessTick, TICK_INTERVAL_MS);

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3003;
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
