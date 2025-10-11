import 'reflect-metadata';

describe('AppModule definition', () => {
  it('registers REST controllers and ts-rest interceptor', async () => {
    const moduleRef = await import('./app.module');
    const { MODULE_METADATA } = await import('@nestjs/common/constants');
    const { APP_INTERCEPTOR } = await import('@nestjs/core');
    const { TsRestHandlerInterceptor } = await import('@ts-rest/nest');
    const { AiModule } = await import('../openai/ai.module');
    const { DmApiController } = await import('./api/dm-api.controller');

    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      moduleRef.AppModule,
    );
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      moduleRef.AppModule,
    );
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      moduleRef.AppModule,
    );

    expect(imports).toEqual(expect.arrayContaining([AiModule]));
    expect(controllers).toEqual(expect.arrayContaining([DmApiController]));
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: APP_INTERCEPTOR,
          useClass: TsRestHandlerInterceptor,
        }),
      ]),
    );
  });
});
