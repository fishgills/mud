import { GuildAnnouncementsScheduler } from './guild-announcements.scheduler';

const unsubscribeMock = jest.fn();
const onMock = jest.fn().mockReturnValue(unsubscribeMock);

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: (...args: unknown[]) => onMock(...args),
  },
}));

describe('guild-announcement GuildAnnouncementsScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to world ticks and triggers poll', async () => {
    const service = {
      pollNextAnnouncement: jest.fn().mockResolvedValue({ delivered: true }),
    };
    let tickHandler: ((payload: unknown) => Promise<void>) | undefined;
    onMock.mockImplementation((_event, handler) => {
      tickHandler = handler;
      return unsubscribeMock;
    });

    const scheduler = new GuildAnnouncementsScheduler(service as never);

    scheduler.onModuleInit();

    expect(onMock).toHaveBeenCalledWith(
      'world:time:tick',
      expect.any(Function),
    );
    expect(tickHandler).toBeDefined();

    await tickHandler?.({ eventType: 'world:time:tick' });
    expect(service.pollNextAnnouncement).toHaveBeenCalledWith('tick');

    scheduler.onModuleDestroy();
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
