/**
 * Tests ensure the tracer singleton initializes Datadog tracing only once
 * and that the index re-export stays in sync with the register module.
 */
const initMock = jest.fn();

jest.mock('dd-trace', () => ({
  __esModule: true,
  default: {
    init: initMock,
  },
}));

describe('@mud/tracer', () => {
  beforeEach(() => {
    jest.resetModules();
    initMock.mockReset();
  });

  it('initializes dd-trace once and returns the same instance', async () => {
    const tracerInstance = { span: 'mock' };
    initMock.mockReturnValue(tracerInstance);

    const registerModule = await import('./register');
    const secondImport = await import('./register');

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(registerModule.default).toBe(tracerInstance);
    expect(secondImport.default).toBe(tracerInstance);
  });

  it('re-exports the register instance via index.ts', async () => {
    const tracerInstance = { span: 'index' };
    initMock.mockReturnValue(tracerInstance);

    const registerModule = await import('./register');
    const indexModule = await import('./index');

    expect(indexModule.default).toBe(registerModule.default);
  });
});
