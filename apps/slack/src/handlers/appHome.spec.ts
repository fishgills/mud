import type { App } from '@slack/bolt';
import type { ActionsBlock, KnownBlock } from '@slack/types';
import { buildAppHomeBlocks, registerAppHome } from './appHome';
import { getPlayer } from '../dm-client';

// Mock the DM API client
jest.mock('../dm-client', () => ({
  getPlayer: jest.fn(),
  rerollPlayerStats: jest.fn(),
  completePlayer: jest.fn(),
  deletePlayer: jest.fn(),
}));

type AppHomeHandler = (args: {
  event: { user: string };
  client: { views: { publish: jest.Mock } };
  logger: { error: jest.Mock; info: jest.Mock };
}) => Promise<void> | void;

const isActionsBlock = (block: KnownBlock): block is ActionsBlock =>
  block.type === 'actions';

const buttonTextsFromBlock = (block: ActionsBlock): string[] =>
  block.elements
    .map((element) => {
      if (element.type !== 'button') {
        return undefined;
      }
      return element.text?.type === 'plain_text'
        ? element.text.text
        : undefined;
    })
    .filter((text): text is string => Boolean(text));

describe('buildAppHomeBlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes welcome header and action buttons when user has no character', async () => {
    (getPlayer as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });

    const blocks = await buildAppHomeBlocks('U123');

    expect(blocks[0]).toMatchObject({
      type: 'header',
      text: expect.objectContaining({
        text: expect.stringContaining('Welcome'),
      }),
    });

    // Should have action buttons for creating character
    const actionBlock = blocks.find((block) => block.type === 'actions');
    expect(actionBlock).toBeDefined();
  });

  it('includes character creation buttons when user has incomplete character', async () => {
    (getPlayer as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        name: 'TestChar',
        isAlive: false, // Character not completed
      },
    });

    const blocks = await buildAppHomeBlocks('U123');

    const actionBlock = blocks.find((block) => block.type === 'actions');
    expect(actionBlock).toBeDefined();
    if (actionBlock && isActionsBlock(actionBlock)) {
      const buttonTexts = buttonTextsFromBlock(actionBlock);
      expect(buttonTexts).toContain('🎲 Reroll Stats');
      expect(buttonTexts).toContain('✅ Complete Character');
    }
  });

  it('includes gameplay buttons when user has active character', async () => {
    (getPlayer as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        name: 'TestChar',
        isAlive: true, // Character is active
      },
    });

    const blocks = await buildAppHomeBlocks('U123');

    const actionBlock = blocks.find((block) => block.type === 'actions');
    expect(actionBlock).toBeDefined();
    if (actionBlock && isActionsBlock(actionBlock)) {
      const buttonTexts = buttonTextsFromBlock(actionBlock);
      expect(buttonTexts).toContain('👀 Look Around');
      expect(buttonTexts).toContain('📊 View Stats');
      expect(buttonTexts).toContain('🗺️ View Map');
      expect(buttonTexts).toContain('🎒 View Inventory');
    }
  });
});

describe('registerAppHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers an app_home_opened handler that publishes the view', async () => {
    (getPlayer as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });

    const handlers: Record<string, AppHomeHandler> = {};
    const views = { publish: jest.fn().mockResolvedValue(undefined) };
    const logger = { error: jest.fn(), info: jest.fn() };
    const app = {
      event: jest.fn((eventName: string, handler: AppHomeHandler) => {
        handlers[eventName] = handler;
      }),
      action: jest.fn(), // Mock action handler registration
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
      context: { teamId: 'T1' },
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
    (getPlayer as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });

    const handlers: Record<string, AppHomeHandler> = {};
    const views = { publish: jest.fn().mockRejectedValue(new Error('fail')) };
    const logger = { error: jest.fn(), info: jest.fn() };
    const app = {
      event: jest.fn((eventName: string, handler: AppHomeHandler) => {
        handlers[eventName] = handler;
      }),
      action: jest.fn(), // Mock action handler registration
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
      context: { teamId: 'T1' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to publish App Home',
      expect.any(Error),
    );
  });
});
