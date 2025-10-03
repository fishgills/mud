import type { App } from '@slack/bolt';
import { dmSdk } from '../gql-client';
import { buildAppHomeBlocks, registerAppHome } from './appHome';

jest.mock('../gql-client', () => ({
  dmSdk: {
    GetAllPlayers: jest.fn(),
  },
}));

const mockGetAllPlayers = dmSdk.GetAllPlayers as jest.Mock;

const sampleLeaderboard = [
  {
    __typename: 'Player' as const,
    id: '1',
    slackId: 'U1',
    name: 'Aria',
    level: 5,
    xp: 420,
    isAlive: true,
  },
  {
    __typename: 'Player' as const,
    id: '2',
    slackId: 'U2',
    name: 'Borin',
    level: 4,
    xp: 350,
    isAlive: false,
  },
];

beforeEach(() => {
  mockGetAllPlayers.mockResolvedValue({ getAllPlayers: sampleLeaderboard });
});

afterEach(() => {
  jest.clearAllMocks();
});

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
        ?.map((element) => {
          if (
            (element.type === 'mrkdwn' || element.type === 'plain_text') &&
            typeof (element as any).text === 'string'
          ) {
            return (element as any).text;
          }
          return '';
        })
        .join(' ');
      expect(text).toEqual(expect.stringContaining('Need a refresher'));
    }
  });

  it('renders leaderboard when entries are provided', () => {
    const blocks = buildAppHomeBlocks({ leaderboard: sampleLeaderboard });
    const leaderboardSection = blocks.find(
      (block) => block.type === 'section' &&
        'text' in block &&
        block.text?.type === 'mrkdwn' &&
        block.text.text.includes('Workspace Leaderboard'),
    );

    expect(leaderboardSection).toBeDefined();
    if (leaderboardSection && 'text' in leaderboardSection && leaderboardSection.text) {
      expect(leaderboardSection.text).toMatchObject({
        text: expect.stringContaining('1. *Aria* — Level 5 · 420 XP'),
      });
      expect(leaderboardSection.text).toMatchObject({
        text: expect.stringContaining('2. *Borin* — Level 4 · 350 XP ☠️'),
      });
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
    expect(mockGetAllPlayers).toHaveBeenCalledTimes(1);
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

  it('logs a leaderboard error but still publishes the view', async () => {
    mockGetAllPlayers.mockRejectedValueOnce(new Error('network error'));
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
    if (!handler) {
      throw new Error('app_home_opened handler was not registered');
    }

    await handler({
      event: { user: 'U111' },
      client: { views },
      logger,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load leaderboard',
      expect.any(Error),
    );
    expect(views.publish).toHaveBeenCalled();
  });
});
