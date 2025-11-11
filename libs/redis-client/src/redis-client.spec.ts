import { createClient, type RedisClientType } from 'redis';
import type { GameEvent } from './game-events';
import {
  RedisEventBridge,
  type EventBridgeConfig,
  type NotificationMessage,
} from './event-bridge';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

interface RedisClientMock {
  connect: jest.Mock<Promise<void>, []>;
  quit: jest.Mock<Promise<void>, []>;
  publish: jest.Mock<Promise<number>, [string, string]>;
  duplicate: jest.Mock<RedisClientType, []>;
  on: jest.Mock<void, [string, (err: unknown) => void]>;
  pSubscribe: jest.Mock<
    Promise<void>,
    [string, (message: string, channel: string) => void | Promise<void>]
  >;
  subscribe: jest.Mock<
    Promise<void>,
    [string, (message: string) => void | Promise<void>]
  >;
}

const createRedisClientMock = (): RedisClientMock => ({
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(1),
  duplicate: jest.fn(),
  on: jest.fn(),
  pSubscribe: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
});

const createSampleEvent = (): GameEvent =>
  ({
    eventType: 'player:move',
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
    player: { id: 1, name: 'Aventurer' },
    fromX: 0,
    fromY: 0,
    toX: 1,
    toY: 1,
  }) as unknown as GameEvent;

describe('RedisEventBridge', () => {
  let publisher: RedisClientMock;
  let subscriber: RedisClientMock;
  let createClientMock: jest.MockedFunction<typeof createClient>;
  let infoSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const buildBridge = (
    overrides?: Partial<EventBridgeConfig>,
  ): RedisEventBridge =>
    new RedisEventBridge({
      redisUrl: 'redis://test',
      channelPrefix: 'game',
      enableLogging: true,
      ...overrides,
    });

  beforeAll(() => {
    createClientMock = createClient as jest.MockedFunction<typeof createClient>;
  });

  beforeEach(() => {
    publisher = createRedisClientMock();
    subscriber = createRedisClientMock();
    publisher.duplicate.mockReturnValue(
      subscriber as unknown as RedisClientType,
    );
    createClientMock.mockReturnValue(
      publisher as unknown as RedisClientType,
    );

    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    createClientMock.mockReset();
  });

  it('attaches a publisher error handler immediately', () => {
    buildBridge();
    expect(publisher.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );

    const error = new Error('boom');
    const handler = publisher.on.mock.calls[0][1];
    handler(error);

    expect(errorSpy).toHaveBeenCalledWith(
      { error },
      'Redis Event Bridge publisher error',
    );
  });

  it('connects only once and logs a success message', async () => {
    const bridge = buildBridge();

    await bridge.connect();
    await bridge.connect();

    expect(publisher.connect).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('✅ Redis Event Bridge connected');
  });

  it('disconnects both clients and logs when connected', async () => {
    const bridge = buildBridge();
    await bridge.connect();
    await bridge.subscribeToNotifications('slack', jest.fn());

    await bridge.disconnect();

    expect(publisher.quit).toHaveBeenCalledTimes(1);
    expect(subscriber.quit).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      '👋 Redis Event Bridge disconnected',
    );
  });

  it('is tolerant to disconnect calls before connect', async () => {
    const bridge = buildBridge();
    await bridge.disconnect();

    expect(publisher.quit).not.toHaveBeenCalled();
  });

  it('throws when publishing before connect', async () => {
    const bridge = buildBridge();
    await expect(bridge.publishEvent(createSampleEvent())).rejects.toThrow(
      'Redis Event Bridge not connected',
    );
    await expect(
      bridge.publishNotification({
        type: 'combat',
        recipients: [],
        event: createSampleEvent(),
      }),
    ).rejects.toThrow('Redis Event Bridge not connected');
  });

  it('publishes events with the configured prefix and logs metadata', async () => {
    const bridge = buildBridge();
    await bridge.connect();
    const event = createSampleEvent();

    await bridge.publishEvent(event);

    expect(publisher.publish).toHaveBeenCalledWith(
      'game:player:move',
      JSON.stringify(event),
    );
    expect(debugSpy).toHaveBeenCalledWith(
      { channel: 'game:player:move', eventType: 'player:move' },
      '📤 Published event',
    );
  });

  it('groups notifications by client type and appends timestamps', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-01T00:00:00.000Z'));
    const bridge = buildBridge();
    await bridge.connect();
    const event = createSampleEvent();
    const serializedEvent = JSON.parse(JSON.stringify(event));

    await bridge.publishNotification({
      type: 'combat',
      event,
      recipients: [
        {
          clientType: 'slack',
          teamId: 'T1',
          userId: 'U1',
          message: 'hi',
        } as const,
        {
          clientType: 'discord',
          teamId: undefined,
          userId: 'D1',
          message: 'hey',
        } as const,
        {
          clientType: 'slack',
          teamId: 'T1',
          userId: 'U2',
          message: 'hello',
          priority: 'high',
        },
      ],
    });

    expect(publisher.publish).toHaveBeenCalledTimes(2);

    const payloads = Object.fromEntries(
      publisher.publish.mock.calls.map(([channel, rawPayload]) => [
        channel,
        JSON.parse(rawPayload as string),
      ]),
    );

    const slackPayload = payloads['notifications:slack'];
    const discordPayload = payloads['notifications:discord'];

    expect(slackPayload).toBeDefined();
    expect(discordPayload).toBeDefined();

    expect(slackPayload).toMatchObject({
      type: 'combat',
      event: serializedEvent,
      timestamp: new Date('2024-02-01T00:00:00.000Z').toISOString(),
    });
    expect(slackPayload.recipients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'U1', clientType: 'slack' }),
        expect.objectContaining({
          userId: 'U2',
          clientType: 'slack',
          priority: 'high',
        }),
      ]),
    );

    expect(discordPayload).toMatchObject({
      type: 'combat',
      event: serializedEvent,
      timestamp: new Date('2024-02-01T00:00:00.000Z').toISOString(),
    });
    expect(discordPayload.recipients).toEqual([
      expect.objectContaining({ userId: 'D1', clientType: 'discord' }),
    ]);

    expect(debugSpy).toHaveBeenCalledWith(
      { channel: 'notifications:slack', count: 2, type: 'combat' },
      '📤 Published notifications',
    );
  });

  it('subscribes to events and surfaces parsed payloads', async () => {
    const bridge = buildBridge();
    await bridge.connect();
    const callback = jest.fn();

    await bridge.subscribeToEvents('game:*', callback);

    expect(publisher.duplicate).toHaveBeenCalledTimes(1);
    expect(subscriber.connect).toHaveBeenCalledTimes(1);
    expect(subscriber.pSubscribe).toHaveBeenCalledWith(
      'game:*',
      expect.any(Function),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      { pattern: 'game:*' },
      '👂 Subscribed to pattern',
    );

    const handler = subscriber.pSubscribe.mock.calls[0][1];
    const event = createSampleEvent();
    const serializedEvent = JSON.parse(JSON.stringify(event));
    await handler(JSON.stringify(event), 'game:player:move');

    expect(callback).toHaveBeenCalledWith('game:player:move', serializedEvent);

    await handler('bad json', 'game:error');
    expect(errorSpy).toHaveBeenCalledWith(
      { channel: 'game:error', error: expect.any(SyntaxError) },
      'Error processing event from channel',
    );
  });

  it('subscribes to notifications for a specific client type', async () => {
    const bridge = buildBridge();
    await bridge.connect();
    const callback = jest.fn();

    await bridge.subscribeToNotifications('slack', callback);

    expect(subscriber.subscribe).toHaveBeenCalledWith(
      'notifications:slack',
      expect.any(Function),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      { channel: 'notifications:slack' },
      '👂 Subscribed to notifications',
    );

    const handler = subscriber.subscribe.mock.calls[0][1];
    const notification: NotificationMessage = {
      type: 'player',
      event: createSampleEvent(),
      recipients: [
        {
          clientType: 'slack',
          teamId: 'T1',
          userId: 'U1',
          message: 'msg',
        },
      ],
    };
    const serializedNotification = JSON.parse(JSON.stringify(notification));

    await handler(JSON.stringify(notification));
    expect(callback).toHaveBeenCalledWith(serializedNotification);

    await handler('oops');
    expect(errorSpy).toHaveBeenCalledWith(
      { channel: 'notifications:slack', error: expect.any(SyntaxError) },
      'Error processing notification',
    );
  });

  it('formats combat notifications for Slack recipients', async () => {
    const bridge = buildBridge({ enableLogging: false });
    const publishNotificationSpy = jest
      .spyOn(bridge, 'publishNotification')
      .mockResolvedValue(undefined);
    const event = createSampleEvent();

    await bridge.publishCombatNotifications(event, [
      {
        name: 'Hero',
        message: 'Attacks!',
        teamId: 'T1',
        userId: 'U1',
        role: 'attacker',
      },
      {
        name: 'Sidekick',
        message: 'Watches',
        teamId: 'T1',
        userId: 'U2',
        role: 'observer',
      },
    ]);

    expect(publishNotificationSpy).toHaveBeenCalledWith({
      type: 'combat',
      event,
      recipients: [
        expect.objectContaining({
          userId: 'U1',
          priority: 'high',
        }),
        expect.objectContaining({
          userId: 'U2',
          priority: 'normal',
        }),
      ],
    });
  });
});
