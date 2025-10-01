import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

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
    const context: any = {
      getContext: () => ({ req: { headers: { authorization: 'token', 'user-agent': 'jest' } } }),
      getInfo: () => ({ fieldName: 'testField', operation: { operation: 'query' } }),
      getArgs: () => ({ foo: 'bar' }),
    };
    createMock.mockReturnValue(context);

    const callHandler = { handle: jest.fn(() => of({ success: true })) };

    await lastValueFrom(interceptor.intercept({} as any, callHandler as any));

    expect(createMock).toHaveBeenCalled();
    expect(callHandler.handle).toHaveBeenCalled();
  });
});
