import { Injectable } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { VertexAiService } from './vertex.service';
import { AiTextOptions } from './base-ai.service';
import { env } from '../env';

@Injectable()
export class AiService {
  constructor(
    private readonly openai: OpenaiService,
    private readonly vertex: VertexAiService,
  ) {}

  async getText(prompt: string, options?: AiTextOptions) {
    const useVertex = env.DM_USE_VERTEX_AI;
    if (useVertex) {
      return this.vertex.getText(prompt, options);
    }
    return this.openai.getText(prompt, options);
  }
}
