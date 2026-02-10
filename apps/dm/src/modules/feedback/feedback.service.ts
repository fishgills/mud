import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../openai/ai.service';
import { env } from '../../env';
import { FeedbackRepository } from './feedback.repository';
import { GitHubService } from './github.service';
import {
  SubmitFeedbackDto,
  SubmitFeedbackResponse,
  FeedbackHistoryResponse,
  FeedbackValidationResult,
} from './feedback.dto';
import {
  FEEDBACK_VALIDATION_SYSTEM_PROMPT,
  buildFeedbackValidationPrompt,
  parseFeedbackValidationResponse,
} from './feedback-validation.prompt';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

type FeedbackSubmitter = {
  playerId?: number;
  teamId?: string;
  userId?: string;
};

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly repository: FeedbackRepository,
    private readonly aiService: AiService,
    private readonly githubService: GitHubService,
  ) {}

  async submitFeedback(
    dto: SubmitFeedbackDto,
  ): Promise<SubmitFeedbackResponse> {
    const submitter = this.resolveSubmitter(dto);
    if (!submitter) {
      return this.rejectFeedback(
        'missing_submitter_identity',
        'unknown',
        'Missing feedback submitter identity.',
      );
    }

    const submitterLabel = submitter.playerId
      ? `player:${submitter.playerId}`
      : `slack:${submitter.teamId}/${submitter.userId}`;
    this.logger.log(`Processing feedback from ${submitterLabel}`);
    this.logger.debug(
      `[FEEDBACK-FLOW] Starting feedback submission: submitter=${submitterLabel}, type=${dto.type}`,
    );

    // Check rate limit
    const rateLimitMs = env.FEEDBACK_SUBMISSION_THROTTLE_MS;
    this.logger.debug(
      `[FEEDBACK-FLOW] Checking rate limit for ${submitterLabel}`,
    );
    const recentCount =
      submitter.playerId !== undefined
        ? await this.repository.countRecentByPlayerId(
            submitter.playerId,
            rateLimitMs,
          )
        : await this.repository.countRecentBySubmitter(
            submitter.teamId!,
            submitter.userId!,
            rateLimitMs,
          );
    this.logger.debug(
      `[FEEDBACK-FLOW] Rate limit check: recentCount=${recentCount}`,
    );
    if (recentCount > 0) {
      return this.rejectFeedback(
        'rate_limited',
        submitterLabel,
        `You can only submit feedback once per ${this.formatRateLimitWindow(rateLimitMs)}. Please try again later.`,
      );
    }

    // Validate content length
    if (dto.content.length < 10) {
      return this.rejectFeedback(
        'content_too_short',
        submitterLabel,
        'Feedback must be at least 10 characters long.',
      );
    }

    if (dto.content.length > 2000) {
      return this.rejectFeedback(
        'content_too_long',
        submitterLabel,
        'Feedback must be less than 2000 characters.',
      );
    }

    // Validate with LLM
    this.logger.debug(`[FEEDBACK-FLOW] Starting LLM validation`);
    const validationStart = Date.now();
    const validation = await this.validateFeedback(dto.content, dto.type);
    this.logger.debug(
      `[FEEDBACK-FLOW] LLM validation completed in ${Date.now() - validationStart}ms`,
    );

    if (!validation) {
      // LLM validation failed, save as pending and create issue anyway
      this.logger.warn(
        'LLM validation failed, proceeding without classification',
      );
      this.logger.debug(
        `[FEEDBACK-FLOW] Using fallback path due to LLM failure`,
      );
      return this.createFeedbackWithFallback(dto, submitter);
    }

    if (!validation.isValid) {
      const moderationReason =
        validation.rejectionReason ?? 'rejected by moderation';
      this.logger.warn(
        `[FEEDBACK-FLOW] Feedback rejected by moderation: submitter=${submitterLabel}, reason="${moderationReason}"`,
      );
      return this.rejectFeedback(
        'moderation_rejected',
        submitterLabel,
        moderationReason,
      );
    }

    // Create feedback record
    const feedback = await this.repository.create({
      playerId: submitter.playerId,
      submitterTeamId: submitter.teamId,
      submitterUserId: submitter.userId,
      type: dto.type,
      content: dto.content,
      category: validation.category,
      priority: validation.priority,
      summary: validation.summary,
      status: 'pending',
    });

    // Create GitHub issue
    this.logger.debug(
      `[FEEDBACK-FLOW] Created feedback record: id=${feedback.id}, category=${validation.category}, priority=${validation.priority}`,
    );
    let githubResult: { url: string; number: number } | null = null;
    if (this.githubService.isConfigured()) {
      this.logger.debug(`[FEEDBACK-FLOW] Creating GitHub issue`);
      const githubStart = Date.now();
      githubResult = await this.githubService.createFeedbackIssue({
        summary: validation.summary,
        content: dto.content,
        category: validation.category,
        priority: validation.priority,
        tags: validation.tags,
        type: dto.type,
      });
      this.logger.debug(
        `[FEEDBACK-FLOW] GitHub issue creation completed in ${Date.now() - githubStart}ms`,
      );

      if (githubResult) {
        this.logger.debug(
          `[FEEDBACK-FLOW] Updating feedback status with GitHub issue #${githubResult.number}`,
        );
        await this.repository.updateStatus(feedback.id, 'submitted', {
          githubIssueUrl: githubResult.url,
          githubIssueNum: githubResult.number,
        });
      }
    } else {
      this.logger.debug(
        `[FEEDBACK-FLOW] GitHub not configured, skipping issue creation`,
      );
    }

    this.logger.log(
      `Feedback submitted successfully: ${feedback.id}${githubResult ? ` (GitHub #${githubResult.number})` : ''}`,
    );
    this.logger.debug(`[FEEDBACK-FLOW] Feedback submission complete`);

    return {
      success: true,
      feedbackId: feedback.id,
      githubIssueUrl: githubResult?.url,
    };
  }

  async getFeedbackHistory(playerId: number): Promise<FeedbackHistoryResponse> {
    this.logger.debug(
      `[FEEDBACK-FLOW] Fetching feedback history for player ${playerId}`,
    );
    const feedbacks = await this.repository.findByPlayerId(playerId, 5);
    this.logger.debug(
      `[FEEDBACK-FLOW] Found ${feedbacks.length} feedback records for player ${playerId}`,
    );

    return {
      feedbacks: feedbacks.map((f) => ({
        id: f.id,
        type: f.type,
        summary: f.summary,
        status: f.status,
        githubIssueUrl: f.githubIssueUrl,
        createdAt: f.createdAt,
      })),
    };
  }

  async deleteFeedback(
    feedbackId: number,
    playerId: number,
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.debug(
      `[FEEDBACK-FLOW] Delete request: feedbackId=${feedbackId}, playerId=${playerId}`,
    );

    // Verify ownership
    const feedback = await this.repository.findById(feedbackId);
    if (!feedback) {
      this.logger.warn(`Feedback ${feedbackId} not found`);
      return { success: false, message: 'Feedback not found' };
    }

    if (feedback.playerId !== playerId) {
      this.logger.warn(
        `Player ${playerId} attempted to delete feedback ${feedbackId} owned by player ${feedback.playerId}`,
      );
      return {
        success: false,
        message: 'You can only delete your own feedback',
      };
    }

    // Only allow deletion of pending feedback (not yet submitted to GitHub)
    if (feedback.status === 'submitted' && feedback.githubIssueUrl) {
      this.logger.debug(
        `[FEEDBACK-FLOW] Cannot delete submitted feedback ${feedbackId} (has GitHub issue)`,
      );
      return {
        success: false,
        message:
          'Cannot delete feedback that has already been submitted to GitHub',
      };
    }

    await this.repository.delete(feedbackId);
    this.logger.log(`Deleted feedback ${feedbackId} for player ${playerId}`);
    this.logger.debug(
      `[FEEDBACK-FLOW] Feedback ${feedbackId} deleted successfully`,
    );

    return { success: true, message: 'Feedback deleted successfully' };
  }

  private async validateFeedback(
    content: string,
    type: string,
  ): Promise<FeedbackValidationResult | null> {
    try {
      const prompt = `${FEEDBACK_VALIDATION_SYSTEM_PROMPT}\n\n${buildFeedbackValidationPrompt(content, type)}`;

      const response = await this.aiService.getText(prompt, {
        timeoutMs: 5000, // Give LLM more time for this task
        maxTokens: 500,
      });

      if (!response.output_text) {
        this.logger.warn('Empty response from LLM validation');
        return null;
      }

      const parsed = parseFeedbackValidationResponse(response.output_text);
      if (!parsed) {
        this.logger.warn(
          `Failed to parse LLM response: ${response.output_text.substring(0, 200)}`,
        );
        return null;
      }

      return {
        isValid: parsed.isValid,
        rejectionReason: parsed.rejectionReason,
        category: parsed.category,
        priority: parsed.priority,
        summary: parsed.summary,
        tags: parsed.tags,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`LLM validation error: ${err.message}`);
      return null;
    }
  }

  private async createFeedbackWithFallback(
    dto: SubmitFeedbackDto,
    submitter: FeedbackSubmitter,
  ): Promise<SubmitFeedbackResponse> {
    // Create feedback with minimal classification
    const summary =
      dto.content.substring(0, 60) + (dto.content.length > 60 ? '...' : '');
    const category = dto.type === 'bug' ? 'bug' : 'feature';

    const feedback = await this.repository.create({
      playerId: submitter.playerId,
      submitterTeamId: submitter.teamId,
      submitterUserId: submitter.userId,
      type: dto.type,
      content: dto.content,
      category,
      priority: 'medium',
      summary,
      status: 'pending',
    });

    // Still try to create GitHub issue
    let githubResult: { url: string; number: number } | null = null;
    if (this.githubService.isConfigured()) {
      githubResult = await this.githubService.createFeedbackIssue({
        summary,
        content: dto.content,
        category,
        priority: 'medium',
        tags: [],
        type: dto.type,
      });

      if (githubResult) {
        await this.repository.updateStatus(feedback.id, 'submitted', {
          githubIssueUrl: githubResult.url,
          githubIssueNum: githubResult.number,
        });
      }
    }

    return {
      success: true,
      feedbackId: feedback.id,
      githubIssueUrl: githubResult?.url,
    };
  }

  private resolveSubmitter(dto: SubmitFeedbackDto): FeedbackSubmitter | null {
    if (dto.playerId !== undefined && dto.playerId !== null) {
      return {
        playerId: dto.playerId,
        teamId: dto.teamId,
        userId: dto.userId,
      };
    }

    if (dto.teamId && dto.userId) {
      return {
        teamId: dto.teamId,
        userId: dto.userId,
      };
    }

    return null;
  }

  private rejectFeedback(
    reasonCode: string,
    submitterLabel: string,
    rejectionReason: string,
  ): SubmitFeedbackResponse {
    this.logger.warn(
      `[FEEDBACK-FLOW] Feedback rejected: code=${reasonCode}, submitter=${submitterLabel}, reason="${rejectionReason}"`,
    );
    return {
      success: false,
      rejectionReason,
    };
  }

  private formatRateLimitWindow(rateLimitMs: number): string {
    if (rateLimitMs % HOUR_MS === 0) {
      const hours = rateLimitMs / HOUR_MS;
      return hours === 1 ? 'hour' : `${hours} hours`;
    }

    if (rateLimitMs % MINUTE_MS === 0) {
      const minutes = rateLimitMs / MINUTE_MS;
      return minutes === 1 ? 'minute' : `${minutes} minutes`;
    }

    const seconds = Math.max(1, Math.round(rateLimitMs / SECOND_MS));
    return seconds === 1 ? 'second' : `${seconds} seconds`;
  }
}
