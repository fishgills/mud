import { AiService } from './ai.service';
import type { AiTextOptions } from './base-ai.service';
import type { OpenaiService } from './openai.service';
import type { VertexAiService } from './vertex.service';
import { refreshEnv } from '../env';

describe('AiService', () => {
  const createMocks = () => {
    const openai = { getText: jest.fn() };
    const vertex = { getText: jest.fn() };
    const service = new AiService(
      openai as unknown as OpenaiService,
      vertex as unknown as VertexAiService,
    );
    return { service, openai, vertex };
  };

  const resetFlag = () => {
    delete process.env.DM_USE_VERTEX_AI;
    refreshEnv();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetFlag();
  });

  afterEach(() => {
    resetFlag();
  });

  it('defaults to OpenAI when the Vertex flag is not set', async () => {
    const { service, openai, vertex } = createMocks();
    const prompt = 'Describe the scene';
    const options: AiTextOptions = { maxTokens: 123 };

    openai.getText.mockResolvedValue('openai response');

    await expect(service.getText(prompt, options)).resolves.toBe(
      'openai response',
    );

    expect(openai.getText).toHaveBeenCalledWith(prompt, options);
    expect(vertex.getText).not.toHaveBeenCalled();
  });

  it('uses Vertex AI when DM_USE_VERTEX_AI is true (case-insensitive)', async () => {
    process.env.DM_USE_VERTEX_AI = 'TrUe';
    refreshEnv();
    const { service, openai, vertex } = createMocks();
    const prompt = 'Generate story';

    vertex.getText.mockResolvedValue('vertex response');

    await expect(service.getText(prompt)).resolves.toBe('vertex response');

    expect(vertex.getText).toHaveBeenCalledWith(prompt, undefined);
    expect(openai.getText).not.toHaveBeenCalled();
  });
});
