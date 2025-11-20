import '@mud/tracer/register';

import http from 'http';

// Use global fetch in place of the removed @mud/gcp-auth helper
const authorizedFetch = globalThis.fetch as typeof fetch;

export type TickLogger = Pick<
  typeof console,
  'info' | 'warn' | 'error' | 'debug'
>;

export interface TickExecutionOptions {
  fetchImpl?: typeof fetch;
  dmBaseUrl?: string;
  activityThresholdMinutes?: number;
  logger?: TickLogger;
}

export interface TickServiceOptions extends TickExecutionOptions {
  tickIntervalMs?: number;
  httpModule?: typeof http;
  host?: string;
  port?: number;
  enableSignalHandlers?: boolean;
}

export function normalizeDmBaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  const trimmedPath = parsed.pathname.replace(/\/+$/, '');
  if (!trimmedPath || trimmedPath === '/') {
    parsed.pathname = '/dm';
  } else {
    parsed.pathname = trimmedPath;
  }
  return parsed.toString().replace(/\/$/, '');
}

const DM_API_BASE_URL = normalizeDmBaseUrl(
  process.env.DM_API_BASE_URL || 'http://localhost:3000/dm',
);

// Tick interval in milliseconds (default: 60000 ms = 1 minute)
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '60000', 10);

// How many minutes to check for player activity (default: 30 minutes)
const ACTIVITY_THRESHOLD_MINUTES = parseInt(
  process.env.ACTIVITY_THRESHOLD_MINUTES || '30',
  10,
);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;

export async function hasActivePlayers(
  options: TickExecutionOptions = {},
): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? authorizedFetch;
  const dmBaseUrl = options.dmBaseUrl ?? DM_API_BASE_URL;
  const activityThreshold =
    options.activityThresholdMinutes ?? ACTIVITY_THRESHOLD_MINUTES;
  const logger = options.logger ?? console;

  try {
    const url = new URL(`${dmBaseUrl}/system/active-players`);
    url.searchParams.set('minutesThreshold', String(activityThreshold));
    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      logger.error(
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
    logger.error(
      {
        error: err instanceof Error ? err.message : err,
      },
      'Error checking active players',
    );
    return false;
  }
}

export async function sendProcessTick(
  options: TickExecutionOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? authorizedFetch;
  const dmBaseUrl = options.dmBaseUrl ?? DM_API_BASE_URL;
  const activityThreshold =
    options.activityThresholdMinutes ?? ACTIVITY_THRESHOLD_MINUTES;
  const logger = options.logger ?? console;

  const hasActive = await hasActivePlayers({
    fetchImpl,
    dmBaseUrl,
    activityThresholdMinutes: activityThreshold,
    logger,
  });
  if (!hasActive) {
    logger.info(
      {
        activityThresholdMinutes: activityThreshold,
      },
      'No active players, skipping tick',
    );
    return;
  }

  logger.info('Active players detected, processing tick');
  try {
    const res = await fetchImpl(`${dmBaseUrl}/system/process-tick`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      logger.error(
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
    } catch (error) {
      logger.error({ error }, 'Failed to parse DM response as JSON');
      return;
    }
    const result = payload as {
      success?: boolean;
      message?: string;
      result?: Record<string, unknown>;
    };
    if (result.success) {
      logger.info(
        {
          message: result.message ?? 'success',
          result: result.result,
        },
        'DM processTick succeeded',
      );
    } else {
      logger.warn(
        {
          message: result?.message ?? 'unknown error',
        },
        'DM processTick returned failure',
      );
    }
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err },
      'Error calling DM processTick',
    );
  }
}

export function startTickService(options: TickServiceOptions = {}) {
  const logger = options.logger ?? console;
  const fetchImpl = options.fetchImpl ?? authorizedFetch;
  const dmBaseUrl = options.dmBaseUrl ?? DM_API_BASE_URL;
  const activityThreshold =
    options.activityThresholdMinutes ?? ACTIVITY_THRESHOLD_MINUTES;
  const tickIntervalMs = options.tickIntervalMs ?? TICK_INTERVAL_MS;
  const httpModule = options.httpModule ?? http;
  const host = options.host ?? '0.0.0.0';
  const port = options.port ?? PORT;

  logger.info(
    {
      dmBaseUrl,
      tickIntervalMs,
      activityThresholdMinutes: activityThreshold,
    },
    'Tick service starting',
  );

  const runTick = () =>
    sendProcessTick({
      fetchImpl,
      dmBaseUrl,
      activityThresholdMinutes: activityThreshold,
      logger,
    }).catch((error) => {
      logger.error(
        { error: error instanceof Error ? error.message : error },
        'Tick loop execution failed',
      );
    });

  runTick().catch(() => void 0);
  const interval: NodeJS.Timeout = setInterval(runTick, tickIntervalMs);

  const runningInGke = Boolean(process.env.KUBERNETES_SERVICE_HOST);
  const server = httpModule.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('Bad Request');
      return;
    }
    if (req.url === '/' || req.url.startsWith('/health')) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      if (!runningInGke) {
        logger.debug(
          { url: req.url, method: req.method },
          'Health probe handled',
        );
      }
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
    logger.debug(
      { url: req.url, method: req.method },
      'Unhandled request received',
    );
  });
  server.listen(port, host, () => {
    logger.info({ port, host }, 'HTTP health server listening');
  });

  const removeListener = (
    event: NodeJS.Signals,
    handler: (() => void) | undefined,
  ) => {
    if (!handler) return;
    if (typeof process.off === 'function') {
      process.off(event, handler);
    } else {
      process.removeListener(event, handler);
    }
  };

  let handleSigint: (() => void) | undefined;
  let handleSigterm: (() => void) | undefined;

  const cleanup = (code?: number) => {
    clearInterval(interval);
    server.close();
    removeListener('SIGINT', handleSigint);
    removeListener('SIGTERM', handleSigterm);
    if (typeof code === 'number') {
      process.exit(code);
    }
  };

  const enableSignals =
    options.enableSignalHandlers ?? process.env.NODE_ENV !== 'test';
  if (enableSignals) {
    handleSigint = () => {
      logger.info('Received SIGINT, shutting down');
      cleanup(0);
    };
    handleSigterm = () => {
      logger.info('Received SIGTERM, shutting down');
      cleanup(0);
    };
    process.on('SIGINT', handleSigint);
    process.on('SIGTERM', handleSigterm);
  }

  return { stop: cleanup, server, interval };
}

const shouldAutoStart =
  process.env.NODE_ENV !== 'test' &&
  process.env.TICK_DISABLE_AUTO_START !== '1';

if (shouldAutoStart) {
  startTickService();
}
