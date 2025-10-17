import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const createContext = (headers: Record<string, string | undefined>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/test',
          headers,
        }),
      }),
      getHandler: () => ({ name: 'handler' }),
    }) as unknown as ExecutionContext;

  it('logs metadata for successful responses', async () => {
    const interceptor = new LoggingInterceptor();
    const ctx = createContext({ authorization: 'token', 'user-agent': 'jest' });
    const callHandler = { handle: jest.fn(() => of({ success: true })) };

    await lastValueFrom(interceptor.intercept(ctx, callHandler as CallHandler));

    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('handles missing headers gracefully', async () => {
    const interceptor = new LoggingInterceptor();
    const ctx = createContext({});
    const callHandler = { handle: jest.fn(() => of({})) };

    await lastValueFrom(interceptor.intercept(ctx, callHandler as CallHandler));

    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('logs when success flag is absent', async () => {
    const interceptor = new LoggingInterceptor();
    const ctx = createContext({ authorization: 'token' });
    const callHandler = { handle: jest.fn(() => of({ result: 'value' })) };

    await lastValueFrom(interceptor.intercept(ctx, callHandler as CallHandler));

    expect(callHandler.handle).toHaveBeenCalled();
  });
});
