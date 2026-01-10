import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackRepository } from './feedback.repository';
import { GitHubService } from './github.service';
import { AiModule } from '../../openai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackRepository, GitHubService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
