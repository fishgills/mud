import { MODULE_METADATA } from '@nestjs/common/constants';

jest.mock('./world/world.service', () => ({
  WorldService: class WorldServiceMock {},
}));


describe('AppModule definition', () => {
  it('exposes expected controllers and providers', async () => {
    const module = await import('./app.module');
    const { AppModule } = module;
    expect(AppModule).toBeDefined();

    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AppModule,
    );
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AppModule,
    );

    const controllerNames = controllers
      .map((controller: unknown) =>
        typeof controller === 'function' ? controller.name : undefined,
      )
      .filter((name): name is string => Boolean(name));
    expect(controllerNames).toEqual(
      expect.arrayContaining([
        'AppController',
        'PlayersController',
        'MovementController',
        'SystemController',
      ]),
    );

    const providerNames = providers.map((provider: unknown) => {
      if (typeof provider === 'function') {
        return provider.name;
      }
      if (
        provider &&
        typeof provider === 'object' &&
        'useClass' in provider &&
        provider.useClass
      ) {
        return (provider.useClass as { name?: string }).name;
      }
      return undefined;
    });
    expect(providerNames).toEqual(
      expect.arrayContaining([
        'AppService',
        'PlayerService',
        'MonsterService',
      ]),
    );
  });
});
