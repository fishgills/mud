import type { App } from '@slack/bolt';
import { buildAppHomeBlocks, registerAppHome } from './appHome';
import { HELP_ACTIONS, HOME_ACTIONS, STAT_ACTIONS } from '../commands';
import { getPlayer } from '../dm-client';

// Mock the DM API client
jest.mock('../dm-client', () => ({
  getLeaderboard: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  getPlayer: jest.fn().mockResolvedValue({
    success: true,
    data: { id: 1, name: 'Hero' },
  }),
}));

type AppHomeHandler = (args: {
  event: { user: string };
  client: { views: { publish: jest.Mock } };
  logger: { error: jest.Mock; info: jest.Mock };
}) => Promise<void> | void;

const mockedGetPlayer = getPlayer as jest.MockedFunction<typeof getPlayer>;

describe('buildAppHomeBlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders adventure status and quick actions for existing players', async () => {
    mockedGetPlayer.mockResolvedValueOnce({
      success: true,
      data: {
        id: 1,
        name: 'Hero',
        level: 2,
        hp: 10,
        maxHp: 20,
        xpToNextLevel: 50,
        hasMoved: false,
        hasBattled: false,
      },
    });

    const blocks = await buildAppHomeBlocks('T123', 'U123');
    expect(blocks[0]).toMatchObject({
      type: 'header',
      text: expect.objectContaining({
        text: expect.stringContaining('Adventure Status'),
      }),
    });

    const resumeAction = blocks.find(
      (block) =>
        block.type === 'actions' &&
        'elements' in block &&
        block.elements.some(
          (element) =>
            'action_id' in element && element.action_id === HOME_ACTIONS.RESUME,
        ),
    );
    expect(resumeAction).toBeDefined();

    const quickActionsHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Quick Actions'),
    );
    expect(quickActionsHeader).toBeDefined();

    const leaderboardHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Leaderboards'),
    );
    expect(leaderboardHeader).toBeUndefined();
  });

  it('shows power user sections after moving and battling', async () => {
    mockedGetPlayer.mockResolvedValueOnce({
      success: true,
      data: {
        id: 1,
        name: 'Hero',
        level: 3,
        hp: 14,
        maxHp: 24,
        xpToNextLevel: 80,
        hasMoved: true,
        hasBattled: true,
        skillPoints: 1,
      },
    });

    const blocks = await buildAppHomeBlocks('T123', 'U123');

    const leaderboardHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Leaderboards'),
    );
    expect(leaderboardHeader).toBeDefined();

    const managementHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Character Management'),
    );
    expect(managementHeader).toBeDefined();

    const levelUpAction = blocks.find(
      (block) =>
        block.type === 'actions' &&
        'elements' in block &&
        block.elements.some(
          (element) =>
            'action_id' in element &&
            element.action_id === STAT_ACTIONS.OPEN_LEVEL_UP,
        ),
    );
    expect(levelUpAction).toBeDefined();

    const leaderboardAction = blocks.find(
      (block) =>
        block.type === 'actions' &&
        'elements' in block &&
        block.elements.some(
          (element) =>
            'action_id' in element &&
            element.action_id === HOME_ACTIONS.VIEW_LEADERBOARD,
        ),
    );
    expect(leaderboardAction).toBeDefined();
  });

  it('shows a create character button when no player exists', async () => {
    mockedGetPlayer.mockResolvedValueOnce({
      success: false,
      message: 'Player not found.',
    });

    const blocks = await buildAppHomeBlocks('T123', 'U123');

    expect(blocks).toHaveLength(5);
    expect(blocks[1]).toMatchObject({
      type: 'section',
      text: expect.objectContaining({
        text: expect.stringContaining('Gather your party'),
      }),
    });
    expect(blocks[2]).toMatchObject({
      type: 'actions',
      elements: [
        expect.objectContaining({
          type: 'button',
          action_id: HELP_ACTIONS.CREATE,
        }),
      ],
    });
    expect(blocks[3]).toMatchObject({
      type: 'context',
      elements: [
        expect.objectContaining({
          type: 'mrkdwn',
          text: expect.stringContaining('Takes about 30 seconds'),
        }),
      ],
    });
  });
});

describe('registerAppHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers an app_home_opened handler that publishes the view', async () => {
    const handlers: Record<string, AppHomeHandler> = {};
    const views = { publish: jest.fn().mockResolvedValue(undefined) };
    const logger = { error: jest.fn(), info: jest.fn() };
    const app = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
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
    const handlers: Record<string, AppHomeHandler> = {};
    const views = { publish: jest.fn().mockRejectedValue(new Error('fail')) };
    const logger = { error: jest.fn(), info: jest.fn() };
    const app = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
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
      context: { teamId: 'T1' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to publish App Home',
      expect.any(Error),
    );
  });
});
