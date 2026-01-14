import type { InstallationStore } from '@slack/oauth';
import type { Logger } from '@slack/web-api';
import type { NotificationMessage } from '@mud/redis-client';
import { NotificationService } from './notification.service';

jest.mock('@mud/redis-client', () => {
  const connectMock = jest.fn();
  const disconnectMock = jest.fn();
  const subscribeToNotificationsMock = jest.fn();
  return {
    __esModule: true,
    RedisEventBridge: jest.fn(() => ({
      connect: connectMock,
      disconnect: disconnectMock,
      subscribeToNotifications: subscribeToNotificationsMock,
    })),
    __redisMocks: {
      connectMock,
      disconnectMock,
      subscribeToNotificationsMock,
    },
  };
});

jest.mock('@slack/web-api', () => {
  const openMock = jest.fn();
  const postMessageMock = jest.fn();
  return {
    __esModule: true,
    WebClient: jest.fn(() => ({
      conversations: { open: openMock },
      chat: { postMessage: postMessageMock },
    })),
    Logger: class {},
    __webMocks: {
      openMock,
      postMessageMock,
    },
  };
});

const redisModule = jest.requireMock('@mud/redis-client') as {
  RedisEventBridge: jest.Mock;
  __redisMocks: {
    connectMock: jest.Mock;
    disconnectMock: jest.Mock;
    subscribeToNotificationsMock: jest.Mock;
  };
};

const slackModule = jest.requireMock('@slack/web-api') as {
  WebClient: jest.Mock;
  __webMocks: {
    openMock: jest.Mock;
    postMessageMock: jest.Mock;
  };
};

const { __redisMocks } = redisModule;
const { WebClient, __webMocks } = slackModule;

const buildNotification = (
  recipients: NotificationMessage['recipients'],
): NotificationMessage => ({
  type: 'combat',
  recipients,
    event: {
      eventType: 'combat:end',
      timestamp: new Date(),
      winner: { type: 'player', id: 1, name: 'Hero' },
      loser: { type: 'monster', id: 2, name: 'Goblin' },
    } as unknown as NotificationMessage['event'],
});

const createLogger = (): Logger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as unknown as Logger;

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __webMocks.openMock.mockResolvedValue({
      ok: true,
      channel: { id: 'D123', is_im: true },
    });
    __webMocks.postMessageMock.mockResolvedValue(undefined);
  });

  const getSubscriptionHandler = () => {
    const handler =
      __redisMocks.subscribeToNotificationsMock.mock.calls[0]?.[1];
    if (!handler) {
      throw new Error('notification handler not registered');
    }
    return handler as (notification: NotificationMessage) => Promise<void>;
  };

  it('connects, subscribes, and delivers Slack notifications', async () => {
    const installationStore = {
      fetchInstallation: jest.fn().mockResolvedValue({
        bot: { token: 'xoxb-test' },
      }),
    } as unknown as InstallationStore;
    const service = new NotificationService({
      installationStore,
      logger: createLogger(),
    });

    await service.start();
    expect(__redisMocks.connectMock).toHaveBeenCalled();
    expect(__redisMocks.subscribeToNotificationsMock).toHaveBeenCalledWith(
      'slack',
      expect.any(Function),
    );

    const notification = buildNotification([
      {
        clientType: 'slack',
        teamId: 'T1',
        userId: 'U1',
        message: 'Victory!',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*GG*' } }],
      },
    ]);
    await getSubscriptionHandler()(notification);

    expect(WebClient).toHaveBeenCalledWith('xoxb-test');
    expect(__webMocks.openMock).toHaveBeenCalledWith({ users: 'U1' });
    expect(__webMocks.postMessageMock).toHaveBeenCalledWith({
      channel: 'D123',
      text: 'Victory!',
      blocks: notification.recipients[0].blocks,
    });
  });

  it('falls back to the provided token when installation lookup fails', async () => {
    const installationStore = {
      fetchInstallation: jest
        .fn()
        .mockRejectedValue(new Error('no installation')),
    } as unknown as InstallationStore;
    const service = new NotificationService({
      installationStore,
      fallbackBotToken: 'xoxb-fallback',
      logger: createLogger(),
    });

    await service.start();
    const handler = getSubscriptionHandler();
    await handler(
      buildNotification([
        {
          clientType: 'slack',
          teamId: 'T2',
          userId: 'U9',
          message: 'Alert',
        },
      ]),
    );

    expect(WebClient).toHaveBeenCalledWith('xoxb-fallback');
    expect(__webMocks.postMessageMock).toHaveBeenCalledWith({
      channel: 'D123',
      text: 'Alert',
    });
  });

  it('disconnects the bridge on stop', async () => {
    const service = new NotificationService({
      logger: createLogger(),
    });
    await service.start();
    await service.stop();
    expect(__redisMocks.disconnectMock).toHaveBeenCalled();
  });

  it('applies guild crier formatting overrides', async () => {
    const guildCrier = {
      formatRecipient: jest.fn().mockReturnValue({
        message: '📣 *Heroic News*',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '*Heroic News*' } },
        ],
      }),
    };
    const service = new NotificationService({
      logger: createLogger(),
      fallbackBotToken: 'xoxb-fallback',
      guildCrierService: guildCrier as never,
    });
    await service.start();

    const notification: NotificationMessage = {
      type: 'announcement',
      recipients: [
        {
          clientType: 'slack',
          teamId: 'T1',
          userId: 'U2',
          message: 'Original text',
        },
      ],
      event: {
        eventType: 'guild.announcement.delivered',
        payload: {
          id: '1',
          title: 'Heroic News',
          body: 'The guild celebrates.',
          digest: 'Guild celebrates.',
          priority: 1,
        },
        audience: 'guild',
        timestamp: new Date(),
      } as NotificationMessage['event'],
    };

    await getSubscriptionHandler()(notification);

    expect(guildCrier.formatRecipient).toHaveBeenCalled();
    expect(__webMocks.postMessageMock).toHaveBeenCalledWith({
      channel: 'D123',
      text: '📣 *Heroic News*',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Heroic News*' } },
      ],
    });
  });
});
