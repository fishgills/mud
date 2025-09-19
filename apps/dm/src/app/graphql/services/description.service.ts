import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../../openai/ai.service';
import type {
  CenterTile,
  BiomeSummary,
  VisiblePeak,
  VisibleSettlement,
  TimingMetrics,
} from './look-view-types';
import { NearbyPlayerInfo } from '../types/response.types';

@Injectable()
export class DescriptionService {
  private logger = new Logger(DescriptionService.name);

  constructor(private aiService: AiService) {}

  /**
   * Build a concise hint guiding the user toward nearby players.
   * Examples:
   * - "Players Nearby: north (near)."
   * - "Players Nearby: northwest (far) and east (near)."
   * - "Players Nearby: south (close), northeast (far)."
   */
  private buildNearbyPlayersHint(
    nearbyPlayers: NearbyPlayerInfo[] | undefined,
  ): string {
    if (!nearbyPlayers || nearbyPlayers.length === 0) return '';

    const labelFor = (d: number): 'close' | 'near' | 'far' => {
      if (d <= 2) return 'close';
      if (d <= 6) return 'near';
      return 'far';
    };

    // Group by direction and use the minimum distance for that direction
    const dirMinDist = new Map<string, number>();
    for (const p of nearbyPlayers) {
      const prev = dirMinDist.get(p.direction);
      if (prev === undefined || p.distance < prev) {
        dirMinDist.set(p.direction, p.distance);
      }
    }

    // Sort directions by min distance and take up to 3
    const items = Array.from(dirMinDist.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([dir, dist]) => `${dir} (${labelFor(dist)})`);

    if (items.length === 0) return '';

    const list =
      items.length === 1
        ? items[0]
        : items.length === 2
          ? `${items[0]} and ${items[1]}`
          : `${items[0]}, ${items[1]}, and ${items[2]}`;

    return `Players Nearby: ${list}.`;
  }

  /**
   * Generates fallback description without AI
   */
  generateFallbackDescription(
    visibilityRadius: number,
    centerTile: CenterTile,
    biomeSummary: BiomeSummary[],
    visiblePeaks: VisiblePeak[],
    visibleSettlements: VisibleSettlement[],
    nearbyPlayers?: NearbyPlayerInfo[],
  ): string {
    const topBiomes = biomeSummary.slice(0, 2).map((b) => b.biomeName);
    const peakLine = visiblePeaks.length
      ? `Distant peaks rise to the ${visiblePeaks
          .slice(0, 2)
          .map((p) => p.direction)
          .join(' and ')}`
      : '';

    // Build settlement line; read nicely when you're currently in a settlement
    let settleLine = '';
    if (visibleSettlements.length) {
      const here = visibleSettlements.find((s) => s.distance === 0);
      const others = visibleSettlements.filter((s) => s.distance > 0);
      if (here) {
        const lead = `You're in the ${here.type} ${here.name}.`;
        const also = others.length
          ? ` You also spot ${others
              .slice(0, 2)
              .map((s) => `${s.type} ${s.name} to the ${s.direction}`)
              .join(' and ')}`
          : '';
        settleLine = `${lead}${also}`.trim();
      } else {
        settleLine = `You spot signs of ${others
          .slice(0, 2)
          .map((s) => `${s.type} ${s.name} to the ${s.direction}`)
          .join(' and ')}`;
      }
    }

    return [
      `From here you can see roughly ${visibilityRadius} tiles out across mostly ${
        topBiomes.join(' and ') || centerTile.biomeName
      }.`,
      peakLine,
      settleLine,
      this.buildNearbyPlayersHint(nearbyPlayers),
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
    visibleSettlements: VisibleSettlement[],
    currentSettlement: {
      name?: string;
      type?: string;
      intensity?: number;
    } | null,
    timing: TimingMetrics,
    nearbyPlayers: NearbyPlayerInfo[],
  ): Promise<string> {
    try {
      const inSettlement = Boolean(
        currentSettlement && (currentSettlement.intensity ?? 0) > 0,
      );

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
        visibleSettlements,
        currentSettlement: currentSettlement || null,
        inSettlement,
      };

      const baseInstructions = [
        'Write a short environmental description (2-4 sentences).',
        'Do NOT mention players, inhabitants, or monsters. Focus on place and setting.',
        'Use the JSON context for bearings and features but avoid explicit numbers unless natural.',
      ];

      const intensityVal = currentSettlement?.intensity ?? 0;
      const densityBucket =
        intensityVal >= 0.7
          ? 'high'
          : intensityVal >= 0.4
            ? 'medium'
            : intensityVal > 0
              ? 'low'
              : 'none';

      const settlementFocus = [
        'You are inside a settlement: make the description center on the settlement itself (architecture, layout, immediate surroundings, notable landmarks, atmosphere).',
        'Mention the settlement name and type once if present (e.g., "the hamlet South Manorthorpe").',
        'Optionally reference nearby terrain as backdrop, but keep the settlement as the focal point.',
        'Use currentSettlement.intensity to scale how built-up and busy it feels:',
        '- high (>= 0.7): dense core, closely packed structures, tight lanes, frequent activity/noise.',
        '- medium (0.4-0.69): mixed residential/commercial, some open space, steady but modest activity.',
        '- low (0.01-0.39): outskirts/edge, scattered buildings, paths/hedgerows/fields, quiet/occasional passersby.',
        'Do not invent crowds or specifics beyond what intensity implies; keep it grounded and qualitative.',
      ];

      const landscapeFocus = [
        'You are in the open: focus on terrain, weather, and distant features; settlements are secondary if visible.',
      ];

      const prompt = [
        ...(inSettlement ? settlementFocus : landscapeFocus),
        ...baseInstructions,
        'Context:',
        JSON.stringify(context, null, 2),
      ].join('\n');

      const tAiStart = Date.now();
      this.logger.debug(`getLookView prompt: ${prompt}`);

      const topBiomes = biomeSummary.slice(0, 2).map((b) => b.biomeName);
      const ai = await this.aiService.getText(prompt, {
        timeoutMs: 1200,
        cacheKey: `look:${centerTile.x},${centerTile.y}:${visibilityRadius}:${topBiomes.join(',')}:${visiblePeaks
          .map((p) => p.direction)
          .join('/')}:${visibleSettlements
          .map((s) => `${s.type}-${s.direction}`)
          .join(
            '/',
          )}::${currentSettlement?.name ?? 'none'}:${inSettlement ? 'in' : 'out'}:${densityBucket}`,
        maxTokens: 300,
      });

      timing.tAiMs = Date.now() - tAiStart;
      const aiText = (ai?.output_text ?? '').trim();

      if (aiText) {
        // Append a dynamic, non-cached hint for nearby players (kept out of the cache key)
        if ((nearbyPlayers?.length ?? 0) > 0) {
          const alreadyHas = /Players Nearby:/i.test(aiText);
          if (!alreadyHas) {
            const hint = this.buildNearbyPlayersHint(nearbyPlayers);
            if (hint) return `${aiText} ${hint}`.trim();
          }
        }
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
      visibleSettlements,
      nearbyPlayers,
    );
  }
}
