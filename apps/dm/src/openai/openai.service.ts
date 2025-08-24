import { Injectable, Logger } from '@nestjs/common';
import OpenAIApi from 'openai';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  private openai: OpenAIApi;
  // Simple in-memory cache for AI outputs to avoid repeated calls within a short window
  private cache = new Map<string, { ts: number; text: string }>();
  private readonly CACHE_TTL_MS = Number.parseInt(
    process.env.DM_OPENAI_CACHE_TTL_MS || '300000',
    10,
  ); // default 5 minutes
  private readonly MAX_CACHE_ENTRIES = Number.parseInt(
    process.env.DM_OPENAI_CACHE_MAX || '200',
    10,
  );
  private readonly DEFAULT_TIMEOUT_MS = Number.parseInt(
    process.env.DM_OPENAI_TIMEOUT_MS || '800',
    10,
  );
  constructor() {
    this.openai = new OpenAIApi({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getText(
    prompt: string,
    options?: { timeoutMs?: number; cacheKey?: string; maxTokens?: number },
  ) {
    this.logger.log(
      `OpenAI being called with prompt: ${prompt.substring(0, 100)}...`,
    );

    const cacheKey = options?.cacheKey || prompt;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.ts < this.CACHE_TTL_MS) {
      return { output_text: cached.text };
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'OpenAI API key not configured, returning mock response',
      );
      const mock = this.generateMockResponse(prompt);
      // cache mock too to keep consistency within TTL
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
        - Use general terms for distance (near/far), avoid specific numbers.
      `;
      const call = async () => {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt },
          ],
          max_tokens: options?.maxTokens ?? 120,
          // temperature: 0.9,
        });
        const content =
          response.choices[0]?.message?.content || 'No description generated.';
        return content;
      };

      const timeoutMs = options?.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
      const TIMEOUT_SENTINEL = '__timeout__';
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs),
      );

      const callPromise = call();
      const raced = await Promise.race([callPromise, timeoutPromise]);

      if (raced !== TIMEOUT_SENTINEL) {
        // Got the model response within budget
        this.logger.log(
          `OpenAI response received (within ${timeoutMs}ms budget)`,
        );
        this.setCache(cacheKey, raced as string);
        return { output_text: raced as string };
      }

      // Timeout path: return fallback immediately, but still populate cache
      this.logger.warn(
        `OpenAI timed out after ${timeoutMs}ms; returning fallback`,
      );
      callPromise
        .then((text) => this.setCache(cacheKey, text))
        .catch(() => void 0);
      const fallback = this.generateMockResponse(prompt);
      return { output_text: fallback };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error calling OpenAI: ${error.message}`);
        this.logger.debug(error);
        // Return a fallback response instead of throwing
        const fallback = this.generateMockResponse(prompt);
        this.setCache(cacheKey, fallback);
        return { output_text: fallback };
      } else {
        this.logger.error(`Error calling OpenAI: Unknown error`);
        const fallback = this.generateMockResponse(prompt);
        this.setCache(cacheKey, fallback);
        return { output_text: fallback };
      }
    }
  }

  private setCache(key: string, text: string) {
    try {
      this.cache.set(key, { ts: Date.now(), text });
      // simple eviction when exceeding capacity
      if (this.cache.size > this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value as string | undefined;
        if (oldestKey !== undefined) this.cache.delete(oldestKey);
      }
    } catch {}
  }

  private generateMockResponse(prompt: string): string {
    // Generate a basic response based on the prompt content
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
