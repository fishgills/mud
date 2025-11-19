import type {
  GuildAnnouncementPollRequest,
  GuildAnnouncementPollResponse,
} from '../src/guild';

describe('guild-announcement contracts', () => {
  it('defines poll request metadata', () => {
    const request: GuildAnnouncementPollRequest = {
      jobId: 'guild-crier-worker',
      polledAt: new Date().toISOString(),
      batchSize: 1,
    };

    expect(request.jobId).toContain('guild');
    expect(new Date(request.polledAt).getTime()).toBeGreaterThan(0);
  });

  it('returns poll response payload', () => {
    const response: GuildAnnouncementPollResponse = {
      announced: true,
      correlationId: 'abc-123',
      announcement: {
        id: '7',
        title: 'Heroic News',
        body: 'Champions have cleared the dungeon.',
        digest: 'Champions cleared the dungeon.',
        priority: 5,
      },
    };

    expect(response.announced).toBe(true);
    expect(response.announcement?.title).toContain('Heroic');
  });
});
