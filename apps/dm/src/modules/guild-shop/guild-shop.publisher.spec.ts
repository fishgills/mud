import { Logger } from '@nestjs/common';
import { GuildShopPublisher } from './guild-shop.publisher';
import { EventBus } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import * as battleforgeModule from '../../shared/battleforge-channel.recipients';

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    emit: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../shared/battleforge-channel.recipients', () => ({
  buildBattleforgeRecipients: jest.fn(),
}));

jest.mock('@mud/redis-client', () => ({
  formatWebRecipientId: jest.fn(
    (teamId: string, userId: string) => `${teamId}:${userId}`,
  ),
}));

describe('GuildShopPublisher', () => {
  let publisher: GuildShopPublisher;
  let eventBridge: { publishNotification: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    eventBridge = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
    };
    publisher = new GuildShopPublisher(
      eventBridge as unknown as EventBridgeService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('publishRefresh', () => {
    it('emits a guild.shop.refresh event to the EventBus', async () => {
      (
        battleforgeModule.buildBattleforgeRecipients as jest.Mock
      ).mockResolvedValue([]);

      await publisher.publishRefresh({ source: 'tick', items: 5 });

      expect(EventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'guild.shop.refresh',
          source: 'tick',
          items: 5,
        }),
      );
    });

    it('publishes slack-channel notification via buildBattleforgeRecipients when workspaces configured', async () => {
      const channelRecipients = [
        {
          clientType: 'slack-channel' as const,
          teamId: 'T1',
          channelId: 'C1',
          message: 'x',
          priority: 'low' as const,
        },
        {
          clientType: 'slack-channel' as const,
          teamId: 'T2',
          channelId: 'C2',
          message: 'x',
          priority: 'low' as const,
        },
      ];
      (
        battleforgeModule.buildBattleforgeRecipients as jest.Mock
      ).mockResolvedValue(channelRecipients);

      await publisher.publishRefresh({ source: 'manual', items: 3 });

      expect(
        battleforgeModule.buildBattleforgeRecipients as jest.Mock,
      ).toHaveBeenCalledWith(expect.stringContaining('3 items'));
      expect(eventBridge.publishNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player',
          recipients: channelRecipients,
        }),
      );
    });

    it('does not call publishNotification when no workspaces are configured', async () => {
      (
        battleforgeModule.buildBattleforgeRecipients as jest.Mock
      ).mockResolvedValue([]);

      await publisher.publishRefresh({ source: 'tick', items: 10 });

      expect(eventBridge.publishNotification).not.toHaveBeenCalled();
    });

    it('includes item count in the message sent to battleforge', async () => {
      (
        battleforgeModule.buildBattleforgeRecipients as jest.Mock
      ).mockResolvedValue([]);

      await publisher.publishRefresh({ source: 'tick', items: 7 });

      const [messageArg] = (
        battleforgeModule.buildBattleforgeRecipients as jest.Mock
      ).mock.calls[0] as [string];
      expect(messageArg).toContain('7');
      expect(messageArg).toContain('guild shop');
    });
  });

  describe('publishReceipt', () => {
    it('emits a guild.shop.receipt event to the EventBus', async () => {
      await publisher.publishReceipt({ success: true } as never);

      expect(EventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'guild.shop.receipt' }),
      );
    });

    it('notifies the triggering user via web recipient when context is provided', async () => {
      await publisher.publishReceipt({ success: true } as never, {
        teamId: 'T1',
        userId: 'U1',
      });

      expect(eventBridge.publishNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player',
          recipients: expect.arrayContaining([
            expect.objectContaining({
              clientType: 'web',
              userId: 'T1:U1',
            }),
          ]),
        }),
      );
    });
  });
});
