import { Injectable, Logger } from '@nestjs/common';

// Vertex AI SDK
// Uses Application Default Credentials on Cloud Run/GCP and supports local dev via GOOGLE_APPLICATION_CREDENTIALS
import { VertexAI } from '@google-cloud/vertexai';

@Injectable()
export class VertexAiService {
  private readonly logger = new Logger(VertexAiService.name);

  private readonly projectId =
    process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  private readonly location =
    process.env.GCP_REGION || process.env.VERTEX_LOCATION || 'us-central1';
  private readonly model =
    process.env.DM_VERTEX_MODEL || 'gemini-2.5-flash-lite';

  // Simple in-memory cache similar to OpenAI service
  private cache = new Map<string, { ts: number; text: string }>();
  private readonly CACHE_TTL_MS = Number.parseInt(
    process.env.DM_OPENAI_CACHE_TTL_MS || '300000',
    10,
  );
  private readonly MAX_CACHE_ENTRIES = Number.parseInt(
    process.env.DM_OPENAI_CACHE_MAX || '200',
    10,
  );
  private readonly DEFAULT_TIMEOUT_MS = Number.parseInt(
    process.env.DM_OPENAI_TIMEOUT_MS || '800',
    10,
  );

  private getModel() {
    if (!this.projectId) {
      this.logger.warn(
        'GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT not set; Vertex AI may fail to initialize. Falling back to mock responses.',
      );
      return null;
    }
    const vertex = new VertexAI({
      project: this.projectId,
      location: this.location,
    });
    return vertex.getGenerativeModel({ model: this.model });
  }

  async getText(
    prompt: string,
    options?: { timeoutMs?: number; cacheKey?: string; maxTokens?: number },
  ) {
    this.logger.log(
      `VertexAI being called with prompt: ${prompt.substring(0, 100)}... (model=${this.model})`,
    );

    const cacheKey = options?.cacheKey || `vertex:${prompt}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.ts < this.CACHE_TTL_MS) {
      return { output_text: cached.text };
    }

    const model = this.getModel();
    if (!model) {
      this.logger.warn(
        'Vertex AI model not configured properly; returning mock response',
      );
      // Cache mock too to keep consistency within TTL
      const mock = this.generateMockResponse(prompt);
      this.setCache(cacheKey, mock);
      return { output_text: mock };
    }

    try {
      const systemMessage = `You describe locations in a fantasy world.
        - Output MUST be plain text, no code blocks or Slack formatting.
        - Focus on the environment only; do NOT mention dynamic entities like players or monsters.
        - Be vivid and cohesive with nearby context; keep to 1-3 sentences.
        - Temperature, Height, and Moisture are 0-1 scales (0 cold/low/dry, 1 hot/high/wet).
        - Each x/y coordinate is a tile in a grid, with each tile representing a 100m x 100m area. If a distance is '28', it refers to 28 tiles (2800m).
        - Use general terms for distance (near/far), avoid specific numbers.`;

      const call = async () => {
        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: `${systemMessage}\n${prompt}` }] },
          ],
          generationConfig: {
            maxOutputTokens: options?.maxTokens ?? 120,
          },
        });
        const resp = result.response as unknown as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        // Aggregate all parts text
        const parts: Array<{ text?: string }> =
          resp.candidates?.[0]?.content?.parts || [];
        const text =
          parts.map((p: { text?: string }) => p.text || '').join('') ||
          'No description generated.';
        return text;
      };

      const timeoutMs = options?.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
      const TIMEOUT_SENTINEL = '__timeout__';
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs),
      );

      const callPromise = call();
      const raced = await Promise.race([callPromise, timeoutPromise]);

      if (raced !== TIMEOUT_SENTINEL) {
        this.logger.log(
          `VertexAI response received (within ${timeoutMs}ms budget)`,
        );
        this.setCache(cacheKey, raced as string);
        return { output_text: raced as string };
      }

      this.logger.warn(
        `VertexAI timed out after ${timeoutMs}ms; returning fallback`,
      );
      callPromise
        .then((text) => this.setCache(cacheKey, text))
        .catch(() => undefined);
      const fallback = this.generateMockResponse(prompt);
      return { output_text: fallback };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error calling VertexAI: ${error.message}`);
        this.logger.debug(error);
      } else {
        this.logger.error(`Error calling VertexAI: Unknown error`);
      }
      const fallback = this.generateMockResponse(prompt);
      this.setCache(cacheKey, fallback);
      return { output_text: fallback };
    }
  }

  private setCache(key: string, text: string) {
    try {
      this.cache.set(key, { ts: Date.now(), text });
      if (this.cache.size > this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value as string | undefined;
        if (oldestKey !== undefined) this.cache.delete(oldestKey);
      }
    } catch {
      // no-op
    }
  }

  private generateMockResponse(prompt: string): string {
    if (prompt.includes('players')) {
      return 'You sense other adventurers nearby, their presence adding life to this area.';
    }
    if (prompt.includes('Alpine')) {
      return 'The crisp mountain air fills your lungs as you stand among towering peaks dusted with snow. Hardy alpine plants cling to rocky outcroppings, and the view stretches for miles across the rugged landscape.';
    }
    if (prompt.includes('grassland')) {
      return 'Rolling green hills stretch before you, dotted with wildflowers swaying in the gentle breeze. The grass whispers softly underfoot as you move through this peaceful meadow.';
    }
    return 'You find yourself in a mysterious landscape, filled with unknown wonders waiting to be discovered.';
  }
}
