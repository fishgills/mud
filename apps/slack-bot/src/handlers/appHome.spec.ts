import type { App } from '@slack/bolt';
import { buildAppHomeBlocks, registerAppHome } from './appHome';

type AppHomeHandler = (args: {
  event: { user: string };
  client: { views: { publish: jest.Mock } };
  logger: { error: jest.Mock };
}) => Promise<void> | void;

describe('buildAppHomeBlocks', () => {
  it('includes welcome header and help sections', () => {
    const blocks = buildAppHomeBlocks();

    expect(blocks[0]).toMatchObject({
      type: 'header',
      text: expect.objectContaining({
        text: expect.stringContaining('Welcome'),
      }),
    });
    const contextBlock = blocks.find((block) => block.type === 'context');
    expect(contextBlock).toBeDefined();
    if (contextBlock && 'elements' in contextBlock) {
      const text = contextBlock.elements
        ?.map((element: { text?: string }) => element.text ?? '')
        .join(' ');
      expect(text).toEqual(expect.stringContaining('Need a refresher'));
    }
  });
});

describe('registerAppHome', () => {
  it('registers an app_home_opened handler that publishes the view', async () => {
    const handlers: Record<string, AppHomeHandler> = {};
    const views = { publish: jest.fn().mockResolvedValue(undefined) };
    const logger = { error: jest.fn() };
    const app = {
      event: jest.fn((eventName: string, handler: AppHomeHandler) => {
        handlers[eventName] = handler;
      }),
    } as unknown as App;

    registerAppHome(app);

    const handler = handlers.app_home_opened;
    expect(handler).toBeDefined();
    if (!handler) {
      throw new Error('app_home_opened handler was not registered');
    }
    await handler({
      event: { user: 'U123' },
      client: { views },
      logger,
    });

    expect(views.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'U123',
        view: expect.objectContaining({
          type: 'home',
          blocks: expect.any(Array),
        }),
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an error when publishing fails', async () => {
    const handlers: Record<string, AppHomeHandler> = {};
    const views = { publish: jest.fn().mockRejectedValue(new Error('fail')) };
    const logger = { error: jest.fn() };
    const app = {
      event: jest.fn((eventName: string, handler: AppHomeHandler) => {
        handlers[eventName] = handler;
      }),
    } as unknown as App;

    registerAppHome(app);
    const handler = handlers.app_home_opened;
    if (!handler) {
      throw new Error('app_home_opened handler was not registered');
    }
    await handler({
      event: { user: 'U999' },
      client: { views },
      logger,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to publish App Home',
      expect.any(Error),
    );
  });
});
