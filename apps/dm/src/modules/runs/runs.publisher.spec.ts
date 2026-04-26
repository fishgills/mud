import { Logger } from '@nestjs/common';
import { getPrismaClient, RunStatus } from '@mud/database';
import { EventBus } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { RunsPublisher } from './runs.publisher';
import * as battleforgeModule from '../../shared/battleforge-channel.recipients';
import type { RunEndEvent } from '../../shared/event-bus';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
  RunStatus: {
    CASHED_OUT: 'CASHED_OUT',
    FAILED: 'FAILED',
  },
}));

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: jest.fn(),
  },
}));

jest.mock('../../shared/battleforge-channel.recipients', () => ({
  buildBattleforgeRecipients: jest.fn(),
}));

describe('RunsPublisher', () => {
  let publisher: RunsPublisher;
  let eventBridge: { publishNotification: jest.Mock };
  let prismaMock: {
    guild: { findUnique: jest.Mock };
    runParticipant: { findMany: jest.Mock };
  };
  let runEndListener: ((event: RunEndEvent) => Promise<void>) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    eventBridge = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
    };
    prismaMock = {
      guild: { findUnique: jest.fn() },
      runParticipant: { findMany: jest.fn() },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);

    (EventBus.on as jest.Mock).mockImplementation((eventType, callback) => {
      if (eventType === 'run:end') {
        runEndListener = callback as (event: RunEndEvent) => Promise<void>;
      }
      return jest.fn();
    });

    publisher = new RunsPublisher(eventBridge as unknown as EventBridgeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('subscribes to run:end on module init', () => {
    publisher.onModuleInit();
    expect(EventBus.on).toHaveBeenCalledWith('run:end', expect.any(Function));
  });

  it('calls unsubscribe on module destroy', () => {
    const unsub = jest.fn();
    (EventBus.on as jest.Mock).mockReturnValue(unsub);
    publisher.onModuleInit();
    publisher.onModuleDestroy();
    expect(unsub).toHaveBeenCalled();
  });

  it('publishes a channel notification for a CASHED_OUT run with guild and multiple participants', async () => {
    publisher.onModuleInit();

    prismaMock.guild.findUnique.mockResolvedValue({ name: 'Iron Wolves' });
    prismaMock.runParticipant.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    const channelRecipients = [
      {
        clientType: 'slack-channel',
        teamId: 'T1',
        channelId: 'C1',
        message: 'x',
        priority: 'low',
      },
    ];
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue(channelRecipients);

    const event: RunEndEvent = {
      eventType: 'run:end',
      runId: 42,
      runType: 'DUNGEON' as never,
      status: RunStatus.CASHED_OUT,
      bankedXp: 200,
      bankedGold: 50,
      leaderId: 1,
      guildId: 99,
      timestamp: new Date(),
    };

    await runEndListener!(event);

    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('Iron Wolves'));
    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('(3 members)'));
    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('200 XP'));
    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('50 gold'));
    expect(eventBridge.publishNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run',
        recipients: channelRecipients,
      }),
    );
  });

  it('uses "A party" as fallback when no guild is associated', async () => {
    publisher.onModuleInit();

    prismaMock.runParticipant.findMany.mockResolvedValue([{ id: 1 }]);
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue([
      {
        clientType: 'slack-channel',
        teamId: 'T1',
        channelId: 'C1',
        message: 'x',
        priority: 'low',
      },
    ]);

    const event: RunEndEvent = {
      eventType: 'run:end',
      runId: 7,
      runType: 'DUNGEON' as never,
      status: RunStatus.CASHED_OUT,
      bankedXp: 100,
      bankedGold: 25,
      leaderId: 1,
      timestamp: new Date(),
    };

    await runEndListener!(event);

    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('A party'));
    // Single participant — no count suffix
    const callArg = (battleforgeModule.buildBattleforgeRecipients as jest.Mock)
      .mock.calls[0][0] as string;
    expect(callArg).not.toContain('members');
  });

  it('does not publish for non-CASHED_OUT run status', async () => {
    publisher.onModuleInit();

    const event: RunEndEvent = {
      eventType: 'run:end',
      runId: 5,
      runType: 'DUNGEON' as never,
      status: RunStatus.FAILED,
      bankedXp: 0,
      bankedGold: 0,
      leaderId: 1,
      timestamp: new Date(),
    };

    await runEndListener!(event);

    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).not.toHaveBeenCalled();
    expect(eventBridge.publishNotification).not.toHaveBeenCalled();
  });

  it('does not publish when no battleforge channels are configured', async () => {
    publisher.onModuleInit();

    prismaMock.guild.findUnique.mockResolvedValue({ name: 'Solo' });
    prismaMock.runParticipant.findMany.mockResolvedValue([{ id: 1 }]);
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue([]);

    const event: RunEndEvent = {
      eventType: 'run:end',
      runId: 10,
      runType: 'DUNGEON' as never,
      status: RunStatus.CASHED_OUT,
      bankedXp: 50,
      bankedGold: 10,
      leaderId: 1,
      guildId: 1,
      timestamp: new Date(),
    };

    await runEndListener!(event);

    expect(eventBridge.publishNotification).not.toHaveBeenCalled();
  });
});
