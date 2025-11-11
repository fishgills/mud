import { EventBridgeService } from './event-bridge.service';
import { RedisEventBridge } from '@mud/redis-client';
import { EventBus } from './event-bus';

jest.mock('@mud/redis-client', () => ({
  RedisEventBridge: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    publishEvent: jest.fn(),
    publishCombatNotifications: jest.fn(),
    publishNotification: jest.fn(),
  })),
}));

describe('EventBridgeService', () => {
  let service: EventBridgeService;
  let bridgeMock: jest.Mocked<RedisEventBridge>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventBridgeService();
    bridgeMock = (RedisEventBridge as jest.Mock).mock.results[0]
      .value as jest.Mocked<RedisEventBridge>;
  });

  it('connects on init and forwards EventBus events', async () => {
    const listenerSpies: Array<(event: any) => Promise<void>> = [];
    jest.spyOn(EventBus, 'onAny').mockImplementation((fn: any) => {
      listenerSpies.push(fn);
      return jest.fn();
    });

    await service.onModuleInit();
    expect(bridgeMock.connect).toHaveBeenCalled();

    await listenerSpies[0]!({ eventType: 'player:move' });
    expect(bridgeMock.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'player:move' }),
    );
  });

  it('disconnects bridge on module destroy', async () => {
    await service.onModuleDestroy();
    expect(bridgeMock.disconnect).toHaveBeenCalled();
  });

  it('proxies combat notifications and generic notifications', async () => {
    const event = { eventType: 'combat:start' } as any;
    await service.publishCombatNotifications(event, [
      { teamId: 'T', userId: 'U', name: 'Hero', message: 'msg', role: 'attacker' },
    ]);
    expect(bridgeMock.publishCombatNotifications).toHaveBeenCalledWith(
      event,
      expect.any(Array),
    );

    const recipients = [{ teamId: 'T', userId: 'U', clientType: 'slack' } as any];
    await service.publishPlayerNotification(event, recipients);
    expect(bridgeMock.publishNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'player',
        recipients,
        event,
      }),
    );
  });

  it('publishes arbitrary notifications', async () => {
    const message = {
      type: 'player',
      event: { eventType: 'player:spawn' },
      recipients: [],
    } as any;
    await service.publishNotification(message);
    expect(bridgeMock.publishNotification).toHaveBeenCalledWith(message);
  });
});
