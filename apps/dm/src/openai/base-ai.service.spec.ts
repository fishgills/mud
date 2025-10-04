import { BaseAiService, AiTextOptions } from './base-ai.service';

class TestAiService extends BaseAiService {
  public configured = true;
  public warning: string | undefined;
  public cachePrefixValue: string | undefined;
  public invokeMock = jest.fn<
    Promise<string>,
    [string, string, AiTextOptions | undefined]
  >();

  constructor() {
    super('TestAiService');
  }

  protected get providerLabel(): string {
    return 'TestAI';
  }

  protected override get cachePrefix(): string | undefined {
    return this.cachePrefixValue;
  }

  protected isConfigured(): boolean {
    return this.configured;
  }

  protected configurationWarning(): string | undefined {
    return this.warning;
  }

  protected invokeModel(
    prompt: string,
    systemMessage: string,
    options?: AiTextOptions,
  ): Promise<string> {
    return this.invokeMock(prompt, systemMessage, options);
  }
}

const ORIGINAL_ENV = process.env;

describe('BaseAiService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('invokes the model and caches subsequent calls', async () => {
    const service = new TestAiService();
    const systemMessage = (
      service as unknown as { getSystemMessage: () => string }
    ).getSystemMessage();

    service.invokeMock.mockResolvedValueOnce('first response');

    await expect(service.getText('describe cave')).resolves.toEqual({
      output_text: 'first response',
    });

    await expect(service.getText('describe cave')).resolves.toEqual({
      output_text: 'first response',
    });

    expect(service.invokeMock).toHaveBeenCalledTimes(1);
    expect(service.invokeMock).toHaveBeenCalledWith(
      'describe cave',
      systemMessage,
      undefined,
    );
  });

  it('honors custom cache keys and prefixes', async () => {
    const service = new TestAiService();
    service.cachePrefixValue = 'vertex';
    service.invokeMock.mockResolvedValue('cached');

    await expect(
      service.getText('prompt', { cacheKey: 'custom-cache' }),
    ).resolves.toEqual({ output_text: 'cached' });
    expect(
      (
        service as unknown as { buildCacheKey: (prompt: string) => string }
      ).buildCacheKey('prompt'),
    ).toBe('vertex:prompt');
  });

  it('expires cached entries after TTL and evicts oldest entries', async () => {
    process.env.DM_OPENAI_CACHE_TTL_MS = '50';
    process.env.DM_OPENAI_CACHE_MAX = '1';
    const service = new TestAiService();

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);
    service.invokeMock.mockResolvedValueOnce('alpha');
    await service.getText('first');

    nowSpy.mockReturnValue(1_010);
    service.invokeMock.mockResolvedValueOnce('beta');
    await service.getText('second');

    nowSpy.mockReturnValue(1_070); // Beyond TTL so first call must refresh
    service.invokeMock.mockResolvedValueOnce('alpha-refreshed');
    await expect(service.getText('first')).resolves.toEqual({
      output_text: 'alpha-refreshed',
    });

    expect(service.invokeMock).toHaveBeenCalledTimes(3);
  });

  it('returns empty output when provider is not configured', async () => {
    const service = new TestAiService();
    service.configured = false;
    service.warning = 'not configured';

    const warnSpy = jest.spyOn(service['logger'], 'warn');

    await expect(service.getText('anything')).resolves.toEqual({
      output_text: '',
    });

    expect(warnSpy).toHaveBeenCalledWith('not configured');
    expect(service.invokeMock).not.toHaveBeenCalled();
  });

  it('returns cached result when provider resolves after timeout', async () => {
    jest.useFakeTimers({ now: 0 });
    const service = new TestAiService();

    service.invokeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('delayed'), 10);
        }),
    );

    const initial = service.getText('slow prompt', { timeoutMs: 5 });

    await jest.advanceTimersByTimeAsync(5);
    await expect(initial).resolves.toEqual({ output_text: '' });

    await jest.advanceTimersByTimeAsync(10);
    await Promise.resolve();

    await expect(service.getText('slow prompt')).resolves.toEqual({
      output_text: 'delayed',
    });

    expect(service.invokeMock).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('gracefully handles provider errors', async () => {
    const service = new TestAiService();
    const error = new Error('boom');
    error.stack = 'stacktrace';
    service.invokeMock.mockRejectedValue(error);

    const errorSpy = jest.spyOn(service['logger'], 'error');
    const debugSpy = jest.spyOn(service['logger'], 'debug');

    await expect(service.getText('oops')).resolves.toEqual({
      output_text: '',
    });

    expect(errorSpy).toHaveBeenCalledWith('Error calling TestAI: boom');
    expect(debugSpy).toHaveBeenCalledWith('stacktrace');
  });
});
