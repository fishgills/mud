import { Logger } from '@nestjs/common';

import { env } from '../env';

export interface AiTextOptions {
  timeoutMs?: number;
  cacheKey?: string;
  maxTokens?: number;
  model?: string;
}

interface CachedEntry {
  ts: number;
  text: string;
}

export abstract class BaseAiService {
  protected readonly logger: Logger;

  private cache = new Map<string, CachedEntry>();
  private readonly CACHE_TTL_MS = env.DM_OPENAI_CACHE_TTL_MS;
  private readonly MAX_CACHE_ENTRIES = env.DM_OPENAI_CACHE_MAX;
  private readonly DEFAULT_TIMEOUT_MS = env.DM_OPENAI_TIMEOUT_MS;

  protected constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  async getText(prompt: string, options?: AiTextOptions) {
    const promptPreview = `${prompt.substring(0, 100)}${
      prompt.length > 100 ? '...' : ''
    }`;
    this.logger.log(
      `${this.providerLabel} being called with prompt: ${promptPreview}`,
    );

    const cacheKey = this.buildCacheKey(prompt, options);
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.ts < this.CACHE_TTL_MS) {
      return { output_text: cached.text };
    }

    if (!this.isConfigured()) {
      const warning = this.configurationWarning();
      if (warning) this.logger.warn(warning);
      return { output_text: '' };
    }

    try {
      const call = async () =>
        (await this.invokeModel(prompt, this.getSystemMessage(), options)) ||
        'No description generated.';

      const timeoutMs = options?.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
      const TIMEOUT_SENTINEL = '__timeout__';
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs),
      );

      const callPromise = call();
      const startTime = Date.now();
      const raced = await Promise.race([callPromise, timeoutPromise]);
      const elapsedMs = Date.now() - startTime;
      this.logger.debug(
        `${this.providerLabel} call resolved in ${elapsedMs}ms`,
      );

      if (raced !== TIMEOUT_SENTINEL) {
        this.logger.log(
          `${this.providerLabel} response received (within ${timeoutMs}ms budget)`,
        );
        const text = typeof raced === 'string' ? raced : '';
        if (text.trim()) {
          this.setCache(cacheKey, text);
        }
        return { output_text: text };
      }

      this.logger.warn(
        `${this.providerLabel} timed out after ${timeoutMs}ms; returning empty response`,
      );
      callPromise
        .then((text) => {
          if (text && text.trim()) {
            this.setCache(cacheKey, text);
          }
        })
        .catch(() => undefined);
      return { output_text: '' };
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error ?? 'Unknown'));
      this.logger.error(`Error calling ${this.providerLabel}: ${err.message}`);
      if (err.stack) {
        this.logger.debug(err.stack);
      }
      return { output_text: '' };
    }
  }

  protected buildCacheKey(prompt: string, options?: AiTextOptions): string {
    if (options?.cacheKey) {
      return options.cacheKey;
    }
    const prefix = this.cachePrefix;
    return prefix ? `${prefix}:${prompt}` : prompt;
  }

  protected getSystemMessage(): string {
    return `You narrate scenes and combat in a fantasy world.
        - Output MUST be plain text, no code blocks or Slack formatting.
        - If the prompt is about a location, describe the environment in 1-3 vivid sentences and prefer general distance terms (near/far) over specific numbers; temperature, height, and moisture values range from 0 (low) to 1 (high).
        - If the prompt is about combat, craft a punchy 2-3 sentence battle summary that names combatants, who won, and the overall flow of the fight; avoid citing dice rolls or numeric stats.
        - When unsure, favor immersive storytelling while staying concise and consistent with the provided context.`;
  }

  protected get cachePrefix(): string | undefined {
    return undefined;
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

  protected abstract get providerLabel(): string;
  protected abstract isConfigured(): boolean;
  protected abstract configurationWarning(): string | undefined;
  protected abstract invokeModel(
    prompt: string,
    systemMessage: string,
    options?: AiTextOptions,
  ): Promise<string>;
}
