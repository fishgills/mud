import { Injectable } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { VertexAiService } from './vertex.service';

@Injectable()
export class AiService {
  constructor(
    private readonly openai: OpenaiService,
    private readonly vertex: VertexAiService,
  ) {}

  async getText(
    prompt: string,
    options?: { timeoutMs?: number; cacheKey?: string; maxTokens?: number },
  ) {
    const useVertex =
      (process.env.DM_USE_VERTEX_AI || '').toLowerCase() === 'true';
    if (useVertex) {
      return this.vertex.getText(prompt, options);
    }
    return this.openai.getText(prompt, options);
  }
}
