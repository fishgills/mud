import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../openai/ai.service';
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

const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

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
    this.logger.log(`Processing feedback from player ${dto.playerId}`);

    // Check rate limit
    const recentCount = await this.repository.countRecentByPlayerId(
      dto.playerId,
      RATE_LIMIT_MS,
    );
    if (recentCount > 0) {
      this.logger.warn(`Player ${dto.playerId} is rate limited`);
      return {
        success: false,
        rejectionReason:
          'You can only submit feedback once per hour. Please try again later.',
      };
    }

    // Validate content length
    if (dto.content.length < 10) {
      return {
        success: false,
        rejectionReason: 'Feedback must be at least 10 characters long.',
      };
    }

    if (dto.content.length > 2000) {
      return {
        success: false,
        rejectionReason: 'Feedback must be less than 2000 characters.',
      };
    }

    // Validate with LLM
    const validation = await this.validateFeedback(dto.content, dto.type);

    if (!validation) {
      // LLM validation failed, save as pending and create issue anyway
      this.logger.warn(
        'LLM validation failed, proceeding without classification',
      );
      return this.createFeedbackWithFallback(dto);
    }

    if (!validation.isValid) {
      // Create rejected feedback record
      await this.repository.create({
        playerId: dto.playerId,
        type: dto.type,
        content: dto.content,
        status: 'rejected',
        rejectionReason:
          validation.rejectionReason ?? 'Feedback was not accepted',
      });

      this.logger.log(`Feedback rejected: ${validation.rejectionReason}`);

      return {
        success: false,
        rejectionReason:
          validation.rejectionReason ??
          'Your feedback could not be processed. Please ensure it is related to the game.',
      };
    }

    // Create feedback record
    const feedback = await this.repository.create({
      playerId: dto.playerId,
      type: dto.type,
      content: dto.content,
      category: validation.category,
      priority: validation.priority,
      summary: validation.summary,
      status: 'pending',
    });

    // Create GitHub issue
    let githubResult: { url: string; number: number } | null = null;
    if (this.githubService.isConfigured()) {
      githubResult = await this.githubService.createFeedbackIssue({
        summary: validation.summary,
        content: dto.content,
        category: validation.category,
        priority: validation.priority,
        tags: validation.tags,
        type: dto.type,
      });

      if (githubResult) {
        await this.repository.updateStatus(feedback.id, 'submitted', {
          githubIssueUrl: githubResult.url,
          githubIssueNum: githubResult.number,
        });
      }
    }

    this.logger.log(
      `Feedback submitted successfully: ${feedback.id}${githubResult ? ` (GitHub #${githubResult.number})` : ''}`,
    );

    return {
      success: true,
      feedbackId: feedback.id,
      githubIssueUrl: githubResult?.url,
    };
  }

  async getFeedbackHistory(playerId: number): Promise<FeedbackHistoryResponse> {
    const feedbacks = await this.repository.findByPlayerId(playerId, 5);

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
  ): Promise<SubmitFeedbackResponse> {
    // Create feedback with minimal classification
    const summary =
      dto.content.substring(0, 60) + (dto.content.length > 60 ? '...' : '');
    const category = dto.type === 'bug' ? 'bug' : 'feature';

    const feedback = await this.repository.create({
      playerId: dto.playerId,
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
}
