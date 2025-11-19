import { GuildAnnouncementsService } from './guild-announcements.service';

jest.mock('./guild-announcements.metrics', () => ({
  recordGuildAnnouncementMetric: jest.fn(),
}));

describe('guild-announcement GuildAnnouncementsService', () => {
  const repository = {
    fetchNextEligible: jest.fn(),
    markAsAnnounced: jest.fn(),
    getGuildOccupants: jest.fn(),
    getDigestRecipients: jest.fn(),
  } as unknown as Record<string, jest.Mock>;
  const publisher = {
    publish: jest.fn(),
  } as unknown as { publish: jest.Mock };
  const coordination = {
    isEnabled: jest.fn().mockReturnValue(false),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  } as unknown as Record<string, jest.Mock>;

  const makeService = () =>
    new GuildAnnouncementsService(
      repository as never,
      publisher as never,
      coordination as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    coordination.isEnabled.mockReturnValue(false);
    coordination.acquireLock.mockResolvedValue('token');
    coordination.releaseLock.mockResolvedValue(true);
  });

  it('returns false when no pending announcements exist', async () => {
    const service = makeService();
    repository.fetchNextEligible.mockResolvedValue(null);

    const result = await service.pollNextAnnouncement('manual');

    expect(result.delivered).toBe(false);
    expect(repository.markAsAnnounced).not.toHaveBeenCalled();
    expect(coordination.acquireLock).not.toHaveBeenCalled();
  });

  it('publishes announcement when eligible', async () => {
    const service = makeService();
    repository.fetchNextEligible.mockResolvedValue({ id: 1 } as any);
    repository.getGuildOccupants.mockResolvedValue([]);
    repository.getDigestRecipients.mockResolvedValue([]);

    const result = await service.pollNextAnnouncement('tick');

    expect(result.delivered).toBe(true);
    expect(repository.markAsAnnounced).toHaveBeenCalledWith(1);
    expect(publisher.publish).toHaveBeenCalled();
    expect(result.correlationId).toBeDefined();
  });

  it('skips when another worker holds the distributed lock', async () => {
    const service = makeService();
    coordination.isEnabled.mockReturnValue(true);
    coordination.acquireLock.mockResolvedValue(null);

    const result = await service.pollNextAnnouncement('tick');

    expect(result.delivered).toBe(false);
    expect(repository.fetchNextEligible).not.toHaveBeenCalled();
  });

  it('releases lock when enabled', async () => {
    const service = makeService();
    coordination.isEnabled.mockReturnValue(true);
    coordination.acquireLock.mockResolvedValue('token');
    repository.fetchNextEligible.mockResolvedValue({ id: 2 } as any);
    repository.getGuildOccupants.mockResolvedValue([]);
    repository.getDigestRecipients.mockResolvedValue([]);

    await service.pollNextAnnouncement('tick');

    expect(coordination.releaseLock).toHaveBeenCalledWith(
      'guild:announcements:poll',
      expect.any(String),
    );
  });
});
