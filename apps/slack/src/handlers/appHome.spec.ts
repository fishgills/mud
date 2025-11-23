import type { App } from '@slack/bolt';
import type { SectionBlock } from '@slack/types';
import { buildAppHomeBlocks, registerAppHome } from './appHome';
import { getRecentChangelogEntries } from '../services/changelog.service';

// Mock the DM API client
jest.mock('../dm-client', () => ({
  getLeaderboard: jest.fn().mockResolvedValue({
    success: true,
    data: {
      workspace: [],
      global: [],
    },
  }),
}));

jest.mock('../services/changelog.service', () => ({
  getRecentChangelogEntries: jest.fn().mockResolvedValue([
    {
      type: 'feat',
      scope: 'slack',
      description: 'Add changelog',
      hash: 'abc1234',
      breaking: false,
    },
  ]),
}));

type AppHomeHandler = (args: {
  event: { user: string };
  client: { views: { publish: jest.Mock } };
  logger: { error: jest.Mock; info: jest.Mock };
}) => Promise<void> | void;

const mockedGetRecentChangelogEntries =
  getRecentChangelogEntries as jest.MockedFunction<
    typeof getRecentChangelogEntries
  >;

describe('buildAppHomeBlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetRecentChangelogEntries.mockClear();
  });

  it('includes welcome header', async () => {
    const blocks = await buildAppHomeBlocks('T123');

    expect(blocks[0]).toMatchObject({
      type: 'header',
      text: expect.objectContaining({
        text: expect.stringContaining('Welcome'),
      }),
    });
  });

  it('includes leaderboard section', async () => {
    const blocks = await buildAppHomeBlocks('T123');

    // Find leaderboard header
    const leaderboardHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Leaderboard'),
    );
    expect(leaderboardHeader).toBeDefined();
  });

  it('includes help section', async () => {
    const blocks = await buildAppHomeBlocks('T123');

    // Find help/commands header
    const helpHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Commands'),
    );
    expect(helpHeader).toBeDefined();
  });

  it('includes changelog section', async () => {
    const blocks = await buildAppHomeBlocks('T123');
    const changelogHeader = blocks.find(
      (block) =>
        block.type === 'header' &&
        'text' in block &&
        block.text.text.includes('Latest Updates'),
    );
    expect(changelogHeader).toBeDefined();
  });

  it('shows fallback text when changelog is empty', async () => {
    mockedGetRecentChangelogEntries.mockResolvedValueOnce([]);
    const blocks = await buildAppHomeBlocks('T123');
    const changelogSection = blocks.find(
      (block) =>
        block.type === 'section' &&
        'text' in block &&
        (block.text as any).text.includes('No recent Conventional Commits'),
    ) as SectionBlock | undefined;
    expect(changelogSection).toBeDefined();
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
