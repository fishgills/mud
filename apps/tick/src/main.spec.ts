import {
  hasActivePlayers,
  normalizeDmBaseUrl,
  sendProcessTick,
  startTickService,
  type TickLogger,
} from './main';

const createLogger = (): TickLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createFetchResponse = (overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: string;
}) => ({
  ok: overrides.ok ?? true,
  status: overrides.status ?? 200,
  statusText: overrides.statusText ?? 'OK',
  text: jest.fn().mockResolvedValue(overrides.body ?? ''),
});

describe('tick helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes DM base URLs', () => {
    expect(normalizeDmBaseUrl('http://example.com')).toBe(
      'http://example.com/dm',
    );
    expect(normalizeDmBaseUrl('https://foo/dm/')).toBe('https://foo/dm');
  });

  it('detects active players via the DM API', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse({
          body: JSON.stringify({ active: true }),
        }),
      );
    const logger = createLogger();
    const result = await hasActivePlayers({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      activityThresholdMinutes: 42,
      logger,
    });
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('minutesThreshold=42'),
      expect.any(Object),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and returns false when the DM API errors', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse({
          ok: false,
          status: 500,
          body: 'fail',
        }),
      );
    const logger = createLogger();
    const result = await hasActivePlayers({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 }),
      'Active player lookup failed',
    );
  });

  it('handles fetch exceptions while checking activity', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('boom'));
    const logger = createLogger();
    const result = await hasActivePlayers({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'boom' },
      'Error checking active players',
    );
  });

  it('skips ticks when there are no active players', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse({
          body: JSON.stringify({ active: false }),
        }),
      );
    const logger = createLogger();
    await sendProcessTick({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { activityThresholdMinutes: expect.any(Number) },
      'No active players, skipping tick',
    );
  });

  it('processes ticks when the DM API reports activity', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ active: true }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ success: true, message: 'ok' }),
      }),
    );
    const logger = createLogger();
    await sendProcessTick({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://dm/system/process-tick',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'ok' }),
      'DM processTick succeeded',
    );
  });

  it('logs errors when the process tick call fails', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ active: true }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        ok: false,
        status: 503,
        body: 'nope',
      }),
    );
    const logger = createLogger();
    await sendProcessTick({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      'DM processTick failed',
    );
  });

  it('warns when the DM API returns a failure payload', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ active: true }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ success: false, message: 'nope' }),
      }),
    );
    const logger = createLogger();
    await sendProcessTick({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      { message: 'nope' },
      'DM processTick returned failure',
    );
  });

  it('logs JSON parsing errors from the DM API', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ active: true }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: 'not json',
      }),
    );
    const logger = createLogger();
    await sendProcessTick({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(logger.error).toHaveBeenCalledWith(
      { error: expect.any(SyntaxError) },
      'Failed to parse DM response as JSON',
    );
  });

  it('logs network failures when calling process tick', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        body: JSON.stringify({ active: true }),
      }),
    );
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const logger = createLogger();
    await sendProcessTick({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      logger,
    });
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'network' },
      'Error calling DM processTick',
    );
  });

  it('starts the tick service with a custom http module', () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse({
          body: JSON.stringify({ active: false }),
        }),
      );
    const logger = createLogger();
    const server: any = {
      listen: jest.fn((port: number, host: string, cb?: () => void) => {
        cb?.();
        return server;
      }),
      close: jest.fn(),
    };
    const httpStub = {
      createServer: jest.fn((handler: (...args: unknown[]) => void) => {
        server.handle = handler;
        return server;
      }),
    };
    const runtime = startTickService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      dmBaseUrl: 'http://dm',
      httpModule: httpStub as unknown as typeof http,
      tickIntervalMs: 1000,
      port: 9999,
      host: '127.0.0.1',
      logger,
      enableSignalHandlers: false,
    });
    jest.runOnlyPendingTimers();
    expect(httpStub.createServer).toHaveBeenCalled();
    expect(server.listen).toHaveBeenCalledWith(
      9999,
      '127.0.0.1',
      expect.any(Function),
    );
    const healthRes = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    server.handle({ url: '/', method: 'GET' }, healthRes);
    expect(healthRes.statusCode).toBe(200);
    const missingUrlRes = { statusCode: 0, end: jest.fn() };
    server.handle({ method: 'POST' }, missingUrlRes);
    expect(missingUrlRes.statusCode).toBe(400);
    const notFoundRes = { statusCode: 0, end: jest.fn() };
    server.handle({ url: '/unknown', method: 'GET' }, notFoundRes);
    expect(notFoundRes.statusCode).toBe(404);
    runtime.stop();
    expect(server.close).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
