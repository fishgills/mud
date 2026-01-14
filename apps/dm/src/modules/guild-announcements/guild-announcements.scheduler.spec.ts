import { GuildAnnouncementsScheduler } from './guild-announcements.scheduler';

describe('GuildAnnouncementsScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('polls on init and on interval, then stops on destroy', async () => {
    const service = {
      pollNextAnnouncement: jest.fn().mockResolvedValue({ delivered: true }),
    };

    const scheduler = new GuildAnnouncementsScheduler(service as never);

    scheduler.onModuleInit();

    expect(service.pollNextAnnouncement).toHaveBeenCalledWith('tick');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(service.pollNextAnnouncement).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(service.pollNextAnnouncement).toHaveBeenCalledTimes(2);
  });
});
