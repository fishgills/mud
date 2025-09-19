import { Injectable } from '@nestjs/common';
import OpenAIApi from 'openai';

import { AiTextOptions, BaseAiService } from './base-ai.service';

@Injectable()
export class OpenaiService extends BaseAiService {
  private readonly openai: OpenAIApi;

  constructor() {
    super(OpenaiService.name);
    this.openai = new OpenAIApi({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  protected get providerLabel(): string {
    return 'OpenAI';
  }

  protected isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  protected configurationWarning(): string | undefined {
    return 'OpenAI API key not configured, returning mock response';
  }

  protected async invokeModel(
    prompt: string,
    systemMessage: string,
    options?: AiTextOptions,
  ): Promise<string> {
    const response = await this.openai.responses.create({
      model: 'gpt-4o',
      instructions: systemMessage,
      input: prompt,
      max_output_tokens: options?.maxTokens || 150,
    });

    return response.output_text || 'No description generated.';
  }
}
