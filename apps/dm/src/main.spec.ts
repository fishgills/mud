jest.mock('dd-trace', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

const useMock = jest.fn();
const listenMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      use: useMock,
      listen: listenMock,
    }),
  },
}));

jest.mock('@mud/gcp-auth', () => ({
  setAuthLogger: jest.fn(),
}));

jest.mock('./app/app.module', () => ({
  AppModule: class {},
}));

describe('main bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    useMock.mockClear();
    listenMock.mockClear();
  });

  it('initializes tracing and bootstraps Nest application', async () => {
    process.env.PORT = '4321';

    await import('./main');
    await new Promise((resolve) => setImmediate(resolve));

    expect(useMock).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledWith(4321, '0.0.0.0');
  });

  it('defaults port and logs requests when no PORT is set', async () => {
    delete process.env.PORT;
    const { Logger } = await import('@nestjs/common');
    const logSpy = jest.spyOn(Logger.prototype, 'log');

    await import('./main');
    await new Promise((resolve) => setImmediate(resolve));

    expect(listenMock).toHaveBeenCalledWith(3000, '0.0.0.0');

    const middleware = useMock.mock.calls[0][0];
    const next = jest.fn();

    middleware(
      {
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'token',
          'content-type': 'application/json',
          'user-agent': 'jest',
        },
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[DM-HTTP] GET /test');

    logSpy.mockRestore();
  });
});
