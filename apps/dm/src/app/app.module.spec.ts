const forRootMock = jest.fn(() => 'GraphQLModuleMock');

const decoratorFactory = () => () => undefined;

jest.mock('@nestjs/graphql', () => ({
  GraphQLModule: {
    forRoot: forRootMock,
  },
  GqlExecutionContext: { create: jest.fn() },
  ObjectType: () => (target: any) => target,
  InputType: () => (target: any) => target,
  ArgsType: () => (target: any) => target,
  Field: decoratorFactory,
  Int: () => Number,
  Float: () => Number,
  Resolver: () => (target: any) => target,
  Query: decoratorFactory,
  Mutation: decoratorFactory,
  Args: decoratorFactory,
  ResolveField: decoratorFactory,
  Parent: decoratorFactory,
  registerEnumType: jest.fn(),
}));

jest.mock('@nestjs/apollo', () => ({
  ApolloDriver: class {},
}));

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
  Monster: class {},
  Player: class {},
}));

describe('AppModule definition', () => {
  afterEach(() => {
    forRootMock.mockClear();
  });

  it('registers GraphQL module and providers', async () => {
    const module = await import('./app.module');
    const { MODULE_METADATA } = await import('@nestjs/common/constants');
    const { APP_INTERCEPTOR } = await import('@nestjs/core');
    const { LoggingInterceptor } = await import('./interceptors/logging.interceptor');
    const { AiModule } = await import('../openai/ai.module');

    expect(module.AppModule).toBeDefined();
    expect(forRootMock).toHaveBeenCalledWith({
      driver: expect.any(Function),
      autoSchemaFile: 'dm-schema.gql',
    });

    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, module.AppModule);
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module.AppModule);

    expect(imports).toEqual(expect.arrayContaining(['GraphQLModuleMock', AiModule]));
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }),
      ]),
    );
  });
});
