import { Injectable } from '@nestjs/common';
import { VertexAI } from '@google-cloud/vertexai';

import { AiTextOptions, BaseAiService } from './base-ai.service';

@Injectable()
export class VertexAiService extends BaseAiService {
  private readonly projectId =
    process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  private readonly location =
    process.env.GCP_REGION || process.env.VERTEX_LOCATION || 'us-central1';
  private readonly modelName = 'gemini-2.5-flash-lite';
  private modelInstance:
    | ReturnType<VertexAI['getGenerativeModel']>
    | null
    | undefined;

  constructor() {
    super(VertexAiService.name);
  }

  protected get providerLabel(): string {
    return 'VertexAI';
  }

  protected get cachePrefix(): string {
    return 'vertex';
  }

  protected isConfigured(): boolean {
    return Boolean(this.projectId);
  }

  protected configurationWarning(): string | undefined {
    return 'GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT not set; returning mock response';
  }

  protected async invokeModel(
    prompt: string,
    systemMessage: string,
    options?: AiTextOptions,
  ): Promise<string> {
    const model = this.getModel();
    if (!model) {
      throw new Error('Vertex AI model not configured');
    }

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemMessage}\n${prompt}` }] },
      ],
      generationConfig: options?.maxTokens
        ? { maxOutputTokens: options.maxTokens }
        : undefined,
    });

    const response = result.response as unknown as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((part) => part.text || '').join('');
    return text || 'No description generated.';
  }

  private getModel() {
    if (this.modelInstance !== undefined) {
      return this.modelInstance;
    }

    if (!this.projectId) {
      this.modelInstance = null;
      return this.modelInstance;
    }

    try {
      const vertex = new VertexAI({
        project: this.projectId,
        location: this.location,
      });
      this.modelInstance = vertex.getGenerativeModel({ model: this.modelName });
      return this.modelInstance;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to initialize VertexAI client: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Failed to initialize VertexAI client');
      }
      this.modelInstance = null;
      return this.modelInstance;
    }
  }
}
