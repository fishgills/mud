import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../../openai/ai.service';
import type {
  CenterTile,
  BiomeSummary,
  VisiblePeak,
  TimingMetrics,
} from './look-view-types';

@Injectable()
export class DescriptionService {
  private logger = new Logger(DescriptionService.name);

  constructor(private aiService: AiService) {}

  /**
   * Generates fallback description without AI
   */
  generateFallbackDescription(
    visibilityRadius: number,
    centerTile: CenterTile,
    biomeSummary: BiomeSummary[],
    visiblePeaks: VisiblePeak[],
  ): string {
    const topBiomes = biomeSummary.slice(0, 2).map((b) => b.biomeName);
    const peakLine = visiblePeaks.length
      ? `Distant peaks rise to the ${visiblePeaks
          .slice(0, 2)
          .map((p) => p.direction)
          .join(' and ')}`
      : '';

    return [
      `From here you can see roughly ${visibilityRadius} tiles out across mostly ${
        topBiomes.join(' and ') || centerTile.biomeName
      }.`,
      peakLine,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Generates AI-enhanced description
   */
  async generateAiDescription(
    centerTile: CenterTile,
    visibilityRadius: number,
    biomeSummary: BiomeSummary[],
    visiblePeaks: VisiblePeak[],
    timing: TimingMetrics,
  ): Promise<string> {
    try {
      const context = {
        center: {
          x: centerTile.x,
          y: centerTile.y,
          biomeName: centerTile.biomeName,
          height: centerTile.height,
        },
        visibilityRadius,
        biomeSummary,
        visiblePeaks,
      };

      const baseInstructions = [
        'Write a short environmental description (2-4 sentences).',
        'Do NOT mention players, inhabitants, or monsters. Focus on place and setting.',
        'Use the JSON context for bearings and features but avoid explicit numbers unless natural.',
      ];

      const prompt = [
        ...baseInstructions,
        'Context:',
        JSON.stringify(context, null, 2),
      ].join('\n');

      const tAiStart = Date.now();
      this.logger.debug(`getLookView prompt: ${prompt}`);

      const topBiomes = biomeSummary.slice(0, 2).map((b) => b.biomeName);
      const ai = await this.aiService.getText(prompt, {
        timeoutMs: 3000,
        cacheKey: `look:${centerTile.x},${centerTile.y}:${visibilityRadius}:${topBiomes.join(',')}:${visiblePeaks
          .map((p) => p.direction)
          .join('/')}`,
      });

      timing.tAiMs = Date.now() - tAiStart;
      const aiText = (ai?.output_text ?? '').trim();

      if (aiText) {
        return aiText;
      }
    } catch {
      this.logger.debug('Panoramic AI description skipped or failed.');
    }

    return this.generateFallbackDescription(
      visibilityRadius,
      centerTile,
      biomeSummary,
      visiblePeaks,
    );
  }
}
