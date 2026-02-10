import { FeedbackService } from './feedback.service';
import { refreshEnv } from '../../env';

describe('FeedbackService', () => {
  const originalThrottle = process.env.FEEDBACK_SUBMISSION_THROTTLE_MS;

  beforeEach(() => {
    process.env.FEEDBACK_SUBMISSION_THROTTLE_MS = '3600000';
    refreshEnv();
  });

  afterAll(() => {
    if (originalThrottle === undefined) {
      delete process.env.FEEDBACK_SUBMISSION_THROTTLE_MS;
    } else {
      process.env.FEEDBACK_SUBMISSION_THROTTLE_MS = originalThrottle;
    }
    refreshEnv();
  });

  const createRepository = () => ({
    countRecentByPlayerId: jest.fn(),
    countRecentBySubmitter: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    findByPlayerId: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
  });

  const createAiService = () => ({
    getText: jest.fn(),
  });

  const createGithubService = () => ({
    isConfigured: jest.fn(),
    createFeedbackIssue: jest.fn(),
  });

  it('accepts feedback from non-character submitters via team/user identity', async () => {
    const repository = createRepository();
    const aiService = createAiService();
    const githubService = createGithubService();
    const service = new FeedbackService(
      repository as never,
      aiService as never,
      githubService as never,
    );

    repository.countRecentBySubmitter.mockResolvedValueOnce(0);
    repository.create.mockResolvedValueOnce({ id: 99 });
    githubService.isConfigured.mockReturnValueOnce(false);
    aiService.getText.mockResolvedValueOnce({
      output_text: JSON.stringify({
        isValid: true,
        rejectionReason: null,
        category: 'feature',
        priority: 'medium',
        summary: 'Improve tutorial clarity',
        tags: ['tutorial'],
      }),
    });

    const result = await service.submitFeedback({
      teamId: 'T1',
      userId: 'U1',
      type: 'suggestion',
      content: 'Please make tutorial prompts a bit clearer for new players.',
    });

    expect(repository.countRecentBySubmitter).toHaveBeenCalledWith(
      'T1',
      'U1',
      60 * 60 * 1000,
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: undefined,
        submitterTeamId: 'T1',
        submitterUserId: 'U1',
        type: 'suggestion',
      }),
    );
    expect(result).toEqual({
      success: true,
      feedbackId: 99,
      githubIssueUrl: undefined,
    });
  });

  it('rejects invalid feedback with a reason and does not persist it', async () => {
    const repository = createRepository();
    const aiService = createAiService();
    const githubService = createGithubService();
    const service = new FeedbackService(
      repository as never,
      aiService as never,
      githubService as never,
    );

    repository.countRecentBySubmitter.mockResolvedValueOnce(0);
    aiService.getText.mockResolvedValueOnce({
      output_text: JSON.stringify({
        isValid: false,
        rejectionReason: 'inappropriate content',
        category: 'feature',
        priority: 'low',
        summary: 'ignore',
        tags: [],
      }),
    });

    const result = await service.submitFeedback({
      teamId: 'T1',
      userId: 'U1',
      type: 'general',
      content: 'You all are trash and this game sucks',
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      rejectionReason: 'inappropriate content',
    });
  });

  it('applies rate limiting for non-character submitters', async () => {
    const repository = createRepository();
    const aiService = createAiService();
    const githubService = createGithubService();
    const service = new FeedbackService(
      repository as never,
      aiService as never,
      githubService as never,
    );

    repository.countRecentBySubmitter.mockResolvedValueOnce(1);

    const result = await service.submitFeedback({
      teamId: 'T1',
      userId: 'U1',
      type: 'general',
      content: 'This is a valid-length feedback entry.',
    });

    expect(result.success).toBe(false);
    expect(result.rejectionReason).toContain('once per hour');
    expect(aiService.getText).not.toHaveBeenCalled();
  });

  it('uses player-based rate limiting when playerId is provided', async () => {
    const repository = createRepository();
    const aiService = createAiService();
    const githubService = createGithubService();
    const service = new FeedbackService(
      repository as never,
      aiService as never,
      githubService as never,
    );

    repository.countRecentByPlayerId.mockResolvedValueOnce(0);
    repository.create.mockResolvedValueOnce({ id: 77 });
    githubService.isConfigured.mockReturnValueOnce(false);
    aiService.getText.mockResolvedValueOnce({
      output_text: JSON.stringify({
        isValid: true,
        rejectionReason: null,
        category: 'bug',
        priority: 'high',
        summary: 'Combat hangs after attack',
        tags: ['combat'],
      }),
    });

    const result = await service.submitFeedback({
      playerId: 123,
      type: 'bug',
      content: 'Combat hangs after attacking while in a run.',
    });

    expect(repository.countRecentByPlayerId).toHaveBeenCalledWith(
      123,
      60 * 60 * 1000,
    );
    expect(repository.countRecentBySubmitter).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('uses configurable feedback throttle from env', async () => {
    const originalThrottle = process.env.FEEDBACK_SUBMISSION_THROTTLE_MS;
    process.env.FEEDBACK_SUBMISSION_THROTTLE_MS = '120000';
    refreshEnv();

    try {
      const repository = createRepository();
      const aiService = createAiService();
      const githubService = createGithubService();
      const service = new FeedbackService(
        repository as never,
        aiService as never,
        githubService as never,
      );

      repository.countRecentBySubmitter.mockResolvedValueOnce(1);

      const result = await service.submitFeedback({
        teamId: 'T1',
        userId: 'U1',
        type: 'general',
        content: 'This is a valid-length feedback entry.',
      });

      expect(repository.countRecentBySubmitter).toHaveBeenCalledWith(
        'T1',
        'U1',
        120000,
      );
      expect(result.success).toBe(false);
      expect(result.rejectionReason).toContain('once per 2 minutes');
      expect(aiService.getText).not.toHaveBeenCalled();
    } finally {
      if (originalThrottle === undefined) {
        delete process.env.FEEDBACK_SUBMISSION_THROTTLE_MS;
      } else {
        process.env.FEEDBACK_SUBMISSION_THROTTLE_MS = originalThrottle;
      }
      refreshEnv();
    }
  });
});
