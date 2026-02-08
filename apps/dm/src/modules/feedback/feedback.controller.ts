import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import {
  SubmitFeedbackDto,
  SubmitFeedbackResponse,
  FeedbackHistoryResponse,
} from './feedback.dto';

@Controller('feedback')
export class FeedbackController {
  private readonly logger = new Logger(FeedbackController.name);

  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
  ): Promise<SubmitFeedbackResponse> {
    this.logger.log(
      `Received feedback submission from player=${dto.playerId ?? 'none'} submitter=${dto.teamId ?? 'none'}/${dto.userId ?? 'none'}`,
    );
    this.logger.debug(
      `Feedback details: type=${dto.type}, contentLength=${dto.content.length}`,
    );
    const result = await this.feedbackService.submitFeedback(dto);
    this.logger.debug(
      `Feedback submission result: success=${result.success}, feedbackId=${result.feedbackId ?? 'none'}`,
    );
    if (!result.success && result.rejectionReason) {
      this.logger.warn(
        `Feedback rejected: reason="${result.rejectionReason}" player=${dto.playerId ?? 'none'} submitter=${dto.teamId ?? 'none'}/${dto.userId ?? 'none'}`,
      );
    }
    return result;
  }

  @Get('history/:playerId')
  async getFeedbackHistory(
    @Param('playerId') playerId: string,
  ): Promise<FeedbackHistoryResponse> {
    this.logger.debug(`Getting feedback history for playerId=${playerId}`);
    const playerIdNum = parseInt(playerId, 10);
    if (isNaN(playerIdNum)) {
      this.logger.warn(`Invalid playerId provided: ${playerId}`);
      return { feedbacks: [] };
    }
    const result = await this.feedbackService.getFeedbackHistory(playerIdNum);
    this.logger.debug(
      `Returning ${result.feedbacks.length} feedback items for player ${playerIdNum}`,
    );
    return result;
  }

  @Delete(':feedbackId')
  async deleteFeedback(
    @Param('feedbackId') feedbackId: string,
    @Body() body: { playerId: number },
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.log(
      `Delete feedback request: feedbackId=${feedbackId}, playerId=${body.playerId}`,
    );
    const feedbackIdNum = parseInt(feedbackId, 10);
    if (isNaN(feedbackIdNum)) {
      this.logger.warn(`Invalid feedbackId provided: ${feedbackId}`);
      return { success: false, message: 'Invalid feedback ID' };
    }
    return this.feedbackService.deleteFeedback(feedbackIdNum, body.playerId);
  }
}
