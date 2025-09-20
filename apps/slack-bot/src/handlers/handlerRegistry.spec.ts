import {
  getAllHandlers,
  getHandler,
  registerHandler,
} from './handlerRegistry';

describe('handlerRegistry', () => {
  afterEach(() => {
    const handlers = getAllHandlers();
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }
  });

  it('registers handlers and allows lookup by command', async () => {
    const handler = jest.fn(async () => undefined);

    registerHandler('test', handler);

    expect(getHandler('test')).toBe(handler);
    expect(Object.keys(getAllHandlers())).toContain('test');
  });

  it('overwrites handlers when the same command is registered twice', async () => {
    const first = jest.fn(async () => undefined);
    const second = jest.fn(async () => undefined);

    registerHandler('duplicate', first);
    registerHandler('duplicate', second);

    const resolved = getHandler('duplicate');
    expect(resolved).toBe(second);
    expect(resolved).not.toBe(first);
  });
});
