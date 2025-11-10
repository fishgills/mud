jest.mock('dd-trace', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

const useMock = jest.fn();
const listenMock = jest.fn().mockResolvedValue(undefined);
const setGlobalPrefixMock = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      use: useMock,
      listen: listenMock,
      setGlobalPrefix: setGlobalPrefixMock,
    }),
  },
}));

jest.mock('./app/app.module', () => ({
  AppModule: class {},
}));

import type { Request, Response } from 'express';

describe('main bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    useMock.mockClear();
    listenMock.mockClear();
    setGlobalPrefixMock.mockClear();
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

    await import('./main');
    await new Promise((resolve) => setImmediate(resolve));

    expect(listenMock).toHaveBeenCalledWith(3000, '0.0.0.0');

    const middleware = useMock.mock.calls[0][0];
    const next = jest.fn();
    const onMock = jest.fn();
    const mockRes = {
      on: onMock,
      statusCode: 200,
      getHeader: jest.fn().mockReturnValue(undefined),
    } as unknown as Response;

    middleware(
      {
        method: 'GET',
        url: '/test',
        originalUrl: '/test',
        headers: {
          authorization: 'token',
          'content-type': 'application/json',
          'user-agent': 'jest',
        },
      } as unknown as Request,
      mockRes,
      next,
    );

    expect(next).toHaveBeenCalled();
    expect(onMock).toHaveBeenCalledWith('finish', expect.any(Function));

    // Simulate finish event to trigger logging
    const finishHandler = onMock.mock.calls[0][1];
    finishHandler();
  });
});
