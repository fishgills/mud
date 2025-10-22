import { Injectable } from '@nestjs/common';
import OpenAIApi from 'openai';

import { AiTextOptions, BaseAiService } from './base-ai.service';
import { env } from '../env';

@Injectable()
export class OpenaiService extends BaseAiService {
  private readonly openai: OpenAIApi;
  private readonly hasValidKey: boolean;

  constructor() {
    super(OpenaiService.name);
    const apiKey = env.OPENAI_API_KEY;
    this.hasValidKey = Boolean(apiKey && apiKey !== 'test-openai-key');
    this.openai = new OpenAIApi({
      apiKey,
    });
  }

  protected get providerLabel(): string {
    return 'OpenAI';
  }

  protected isConfigured(): boolean {
    return this.hasValidKey;
  }

  protected configurationWarning(): string | undefined {
    return this.hasValidKey
      ? undefined
      : 'OpenAI API key not configured, returning mock response';
  }

  protected async invokeModel(
    prompt: string,
    systemMessage: string,
    options?: AiTextOptions,
  ): Promise<string> {
    const response = await this.openai.responses.create({
      model: options?.model ?? 'gpt-4o',
      instructions: systemMessage,
      input: prompt,
      max_output_tokens: options?.maxTokens || 150,
    });

    return response.output_text || 'No description generated.';
  }
}
