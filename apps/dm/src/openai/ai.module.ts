import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { VertexAiService } from './vertex.service';
import { AiService } from './ai.service';

@Module({
  providers: [OpenaiService, VertexAiService, AiService],
  exports: [AiService],
})
export class AiModule {}
