import 'reflect-metadata';
import { AiModule } from './ai.module';
import { OpenaiModule } from './openai.module';

const getMetadata = (target: object) =>
  Reflect.getMetadata('providers', target) || [];

describe('AI modules', () => {
  it('exposes providers via metadata', () => {
    expect(getMetadata(AiModule).length).toBeGreaterThan(0);
    expect(getMetadata(OpenaiModule).length).toBeGreaterThan(0);
  });
});
