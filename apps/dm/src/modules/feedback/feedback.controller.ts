import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
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
    this.logger.log(`Received feedback submission from player ${dto.playerId}`);
    return this.feedbackService.submitFeedback(dto);
  }

  @Get('history/:playerId')
  async getFeedbackHistory(
    @Param('playerId') playerId: string,
  ): Promise<FeedbackHistoryResponse> {
    const playerIdNum = parseInt(playerId, 10);
    if (isNaN(playerIdNum)) {
      return { feedbacks: [] };
    }
    return this.feedbackService.getFeedbackHistory(playerIdNum);
  }
}
