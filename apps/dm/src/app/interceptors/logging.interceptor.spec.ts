import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

const { GqlExecutionContext } = jest.requireMock('@nestjs/graphql');
const createMock = GqlExecutionContext.create as jest.Mock;

describe('LoggingInterceptor', () => {
  it('logs request and response metadata', async () => {
    const interceptor = new LoggingInterceptor();
    const context: Record<string, unknown> = {
      getContext: () => ({
        req: { headers: { authorization: 'token', 'user-agent': 'jest' } },
      }),
      getInfo: () => ({
        fieldName: 'testField',
        operation: { operation: 'query' },
      }),
      getArgs: () => ({ foo: 'bar' }),
    };
    createMock.mockReturnValue(context);

    const callHandler = { handle: jest.fn(() => of({ success: true })) };

    await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, callHandler as CallHandler),
    );

    expect(createMock).toHaveBeenCalled();
    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('handles missing user-agent header', async () => {
    const interceptor = new LoggingInterceptor();
    const context: Record<string, unknown> = {
      getContext: () => ({ req: { headers: { authorization: 'token' } } }),
      getInfo: () => ({
        fieldName: 'testField',
        operation: { operation: 'mutation' },
      }),
      getArgs: () => ({}),
    };
    createMock.mockReturnValue(context);

    const callHandler = { handle: jest.fn(() => of({ data: 'result' })) };

    await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, callHandler as CallHandler),
    );

    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('handles missing authorization header', async () => {
    const interceptor = new LoggingInterceptor();
    const context: Record<string, unknown> = {
      getContext: () => ({ req: { headers: { 'user-agent': 'test-agent' } } }),
      getInfo: () => ({
        fieldName: 'query',
        operation: { operation: 'query' },
      }),
      getArgs: () => ({ id: 123 }),
    };
    createMock.mockReturnValue(context);

    const callHandler = { handle: jest.fn(() => of(null)) };

    await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, callHandler as CallHandler),
    );

    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('handles response without success field', async () => {
    const interceptor = new LoggingInterceptor();
    const context: Record<string, unknown> = {
      getContext: () => ({ req: { headers: {} } }),
      getInfo: () => ({
        fieldName: 'getData',
        operation: { operation: 'query' },
      }),
      getArgs: () => ({}),
    };
    createMock.mockReturnValue(context);

    const callHandler = { handle: jest.fn(() => of({ result: 'value' })) };

    await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, callHandler as CallHandler),
    );

    expect(callHandler.handle).toHaveBeenCalled();
  });
});
