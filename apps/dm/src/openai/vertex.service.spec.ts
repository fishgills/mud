import { VertexAiService } from './vertex.service';

jest.mock('@google-cloud/vertexai', () => {
  const generateContent = jest.fn();
  const getGenerativeModel = jest.fn(() => ({
    generateContent,
  }));
  const vertexConstructor = jest.fn(() => ({
    getGenerativeModel,
  }));

  return {
    __esModule: true,
    VertexAI: vertexConstructor,
    __mock: {
      generateContent,
      getGenerativeModel,
      vertexConstructor,
    },
  };
});

const {
  __mock: {
    generateContent: mockGenerateContent,
    getGenerativeModel: mockGetGenerativeModel,
    vertexConstructor: mockVertexConstructor,
  },
} = jest.requireMock('@google-cloud/vertexai') as {
  __mock: {
    generateContent: jest.Mock;
    getGenerativeModel: jest.Mock;
    vertexConstructor: jest.Mock;
  };
};

const ORIGINAL_ENV = process.env;

describe('VertexAiService', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReset().mockImplementation(() => ({
      generateContent: mockGenerateContent,
    }));
    mockVertexConstructor.mockReset().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    }));
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('is not configured when no project ID is provided', () => {
    const service = new VertexAiService();

    expect((service as any).isConfigured()).toBe(false);
    expect(() => (service as any).buildCacheKey('prompt')).not.toThrow();
    expect((service as any).buildCacheKey('prompt')).toBe('vertex:prompt');
  });

  it('initializes Vertex AI client when configured and aggregates text parts', async () => {
    process.env.GCP_PROJECT_ID = 'project';
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          { content: { parts: [{ text: 'Hello ' }, { text: 'world' }] } },
        ],
      },
    });

    const service = new VertexAiService();
    await expect(
      (service as any).invokeModel('prompt', 'system', { maxTokens: 99 }),
    ).resolves.toBe('Hello world');

    expect(mockVertexConstructor).toHaveBeenCalledWith({
      project: 'project',
      location: 'us-central1',
    });
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash-lite',
    });
    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'system\nprompt' }] }],
      generationConfig: { maxOutputTokens: 99 },
    });
  });

  it('omits generation config when no max tokens provided', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'project';
    mockGenerateContent.mockResolvedValueOnce({ response: { candidates: [] } });

    const service = new VertexAiService();
    await expect(
      (service as any).invokeModel('prompt', 'system'),
    ).resolves.toBe('No description generated.');

    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'system\nprompt' }] }],
      generationConfig: undefined,
    });
  });

  it('throws when the Vertex AI model is unavailable', async () => {
    process.env.GCP_PROJECT_ID = 'project';
    mockGetGenerativeModel.mockReturnValueOnce(null);

    const service = new VertexAiService();
    await expect(
      (service as any).invokeModel('prompt', 'system'),
    ).rejects.toThrow('Vertex AI model not configured');
  });

  it('logs initialization errors and prevents reuse after failure', async () => {
    process.env.GCP_PROJECT_ID = 'project';
    const error = new Error('init failed');
    error.stack = 'stack';
    mockVertexConstructor.mockImplementationOnce(() => {
      throw error;
    });

    const service = new VertexAiService();
    const errorSpy = jest.spyOn(service['logger'], 'error');

    await expect(
      (service as any).invokeModel('prompt', 'system'),
    ).rejects.toThrow('Vertex AI model not configured');

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to initialize VertexAI client: init failed',
      'stack',
    );
    await expect(
      (service as any).invokeModel('prompt', 'system'),
    ).rejects.toThrow('Vertex AI model not configured');
    expect(mockVertexConstructor).toHaveBeenCalledTimes(1);
  });

  it('handles non-error initialization failures gracefully', async () => {
    process.env.GCP_PROJECT_ID = 'project';
    mockVertexConstructor.mockImplementationOnce(() => {
      throw 'boom';
    });

    const service = new VertexAiService();
    const errorSpy = jest.spyOn(service['logger'], 'error');

    await expect(
      (service as any).invokeModel('prompt', 'system'),
    ).rejects.toThrow('Vertex AI model not configured');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to initialize VertexAI client',
    );
  });
});
