import OpenAIApi from 'openai';

import { OpenaiService } from './openai.service';

jest.mock('openai', () => {
  const responses = { create: jest.fn() };
  const mockConstructor = jest.fn(() => ({ responses }));
  return {
    __esModule: true,
    default: mockConstructor,
    responses,
  };
});

const OpenAIApiMock = OpenAIApi as unknown as jest.Mock;
const { responses: responsesMock } = jest.requireMock('openai') as {
  responses: { create: jest.Mock };
};

const ORIGINAL_ENV = process.env;

describe('OpenaiService', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('initializes the OpenAI client with the provided API key', () => {
    process.env.OPENAI_API_KEY = 'secret';
    const service = new OpenaiService();

    expect(OpenAIApiMock).toHaveBeenCalledWith({ apiKey: 'secret' });
    expect(
      (service as unknown as { isConfigured: () => boolean }).isConfigured(),
    ).toBe(true);
  });

  it('reports when the API key is missing', () => {
    delete process.env.OPENAI_API_KEY;
    const service = new OpenaiService();

    expect(
      (service as unknown as { isConfigured: () => boolean }).isConfigured(),
    ).toBe(false);
    expect(
      (
        service as unknown as { configurationWarning: () => string | undefined }
      ).configurationWarning(),
    ).toBe('OpenAI API key not configured, returning mock response');
  });

  it('invokes the responses endpoint with provided options', async () => {
    process.env.OPENAI_API_KEY = 'secret';
    responsesMock.create.mockResolvedValueOnce({ output_text: 'story' });
    const service = new OpenaiService();

    await expect(
      (
        service as unknown as {
          invokeModel: (
            prompt: string,
            system: string,
            options?: { maxTokens?: number },
          ) => Promise<string>;
        }
      ).invokeModel('prompt', 'system', { maxTokens: 200 }),
    ).resolves.toBe('story');

    expect(responsesMock.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      instructions: 'system',
      input: 'prompt',
      max_output_tokens: 200,
    });
  });

  it('falls back to default output when provider response is empty', async () => {
    process.env.OPENAI_API_KEY = 'secret';
    responsesMock.create.mockResolvedValueOnce({ output_text: '' });
    const service = new OpenaiService();

    await expect(
      (
        service as unknown as {
          invokeModel: (
            prompt: string,
            system: string,
            options?: { maxTokens?: number },
          ) => Promise<string>;
        }
      ).invokeModel('prompt', 'system'),
    ).resolves.toBe('No description generated.');

    expect(responsesMock.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      instructions: 'system',
      input: 'prompt',
      max_output_tokens: 150,
    });
  });
});
