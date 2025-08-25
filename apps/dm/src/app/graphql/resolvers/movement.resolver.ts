import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { WorldService } from '../../world/world.service';
import { OpenaiService } from '../../../openai/openai.service';
import { PlayerMoveResponse, LookViewResponse } from '../types/response.types';
import { MovePlayerInput } from '../inputs/player.input';
import type { NearbySettlement } from '../../world/world.service';
import { calculateDirection } from '../../shared/direction.util';

@Resolver()
export class MovementResolver {
  private logger = new Logger(MovementResolver.name);

  constructor(
    private playerService: PlayerService,
    private worldService: WorldService,
    private openaiService: OpenaiService,
  ) {}

  @Mutation(() => PlayerMoveResponse)
  async movePlayer(
    @Args('slackId') slackId: string,
    @Args('input') input: MovePlayerInput,
  ): Promise<PlayerMoveResponse> {
    try {
      const player = await this.playerService.movePlayer(slackId, input);
      this.logger.debug(`Moved to (${player.x}, ${player.y})`);
      return { success: true, player };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to move player',
      };
    }
  }

  @Query(() => LookViewResponse)
  async getLookView(
    @Args('slackId') slackId: string,
  ): Promise<LookViewResponse> {
    try {
      const t0 = Date.now();
      let tPlayerMs = 0;
      let tGetCenterMs = 0;
      let tGetCenterNearbyMs = 0;
      let tBoundsTilesMs = 0;
      let tExtBoundsMs = 0;
      let tFilterTilesMs = 0;
      let tPeaksSortMs = 0;
      let tBiomeSummaryMs = 0;
      let tSettlementsFilterMs = 0;
      let tAiMs = 0;
      let tilesCount = 0;
      let peaksCount = 0;

      const tPlayerStart = Date.now();
      const player = await this.playerService.getPlayer(slackId);
      tPlayerMs = Date.now() - tPlayerStart;
      // Start center-with-nearby immediately (single request for center + nearby)
      const tCenterNearbyStart = Date.now();
      const centerWithNearbyPromise = this.worldService
        .getTileInfoWithNearby(player.x, player.y)
        .then((d) => {
          tGetCenterNearbyMs = Date.now() - tCenterNearbyStart;
          return d;
        })
        .catch(() => null as any);

      // Kick off bounds using a conservative max radius to overlap with center fetch
      const maxVisibilityRadius = 12;
      const minXMax = player.x - maxVisibilityRadius;
      const maxXMax = player.x + maxVisibilityRadius;
      const minYMax = player.y - maxVisibilityRadius;
      const maxYMax = player.y + maxVisibilityRadius;
      const tBoundsStart = Date.now();
      const boundsPromise = this.worldService
        .getTilesInBounds(minXMax, maxXMax, minYMax, maxYMax)
        .then((res) => {
          tBoundsTilesMs = Date.now() - tBoundsStart;
          return res;
        });

      const peakScanRadiusMax = 30; // scan far for peaks regardless; we'll filter later
      const tExtBoundsStart = Date.now();
      const extPromise = this.worldService
        .getTilesInBounds(
          player.x - peakScanRadiusMax,
          player.x + peakScanRadiusMax,
          player.y - peakScanRadiusMax,
          player.y + peakScanRadiusMax,
        )
        .then((res) => {
          tExtBoundsMs = Date.now() - tExtBoundsStart;
          return res;
        });

      // Await center data now and compute dynamic visibility
      const centerWithNearby = await centerWithNearbyPromise;
      const centerTile =
        centerWithNearby?.tile ??
        ({
          x: player.x,
          y: player.y,
          biomeName: 'grassland',
          description: '',
          height: 0.5,
          temperature: 0.6,
          moisture: 0.5,
        } as any);

      // Compute visibility radius based on tile height (0..1)
      const base = 10;
      const heightFactor = Math.max(0, Math.min(1, centerTile.height));
      let visibilityRadius = Math.round(base + heightFactor * 7);
      visibilityRadius = Math.max(3, Math.min(12, visibilityRadius));

      // Gather bounds results (already in-flight)
      const [boundTiles, extTiles] = await Promise.all([
        boundsPromise,
        extPromise,
      ]);
      const tFilterTilesStart = Date.now();
      const tiles = boundTiles
        .map((t) => ({
          x: t.x,
          y: t.y,
          biomeName: t.biomeName,
          height: t.height,
        }))
        .filter(
          (t) =>
            Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) <=
            visibilityRadius,
        );
      tFilterTilesMs = Date.now() - tFilterTilesStart;
      tilesCount = tiles.length;

      // Peaks: select top-k highest tiles beyond a near radius so they feel "distant peaks"
      const minPeakDistance = Math.max(3, Math.floor(visibilityRadius / 2));
      const tPeaksSortStart = Date.now();
      const peakCandidates = extTiles
        .filter(
          (t) =>
            Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) >=
              minPeakDistance && t.height >= 0.7,
        )
        .sort((a, b) => b.height - a.height)
        .slice(0, 6);
      tPeaksSortMs = Date.now() - tPeaksSortStart;
      peaksCount = peakCandidates.length;

      const visiblePeaks = peakCandidates.map((t) => {
        const dx = t.x - player.x;
        const dy = t.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const direction = calculateDirection(player.x, player.y, t.x, t.y);
        return { x: t.x, y: t.y, height: t.height, distance, direction };
      });

      // Biome sector summary: count tiles by biome and infer predominant directions
      const tBiomeStart = Date.now();
      const biomeCounts = new Map<string, number>();
      const biomeDirBuckets = new Map<string, Record<string, number>>();
      for (const t of tiles) {
        biomeCounts.set(t.biomeName, (biomeCounts.get(t.biomeName) || 0) + 1);
        const dir = calculateDirection(player.x, player.y, t.x, t.y);
        const bucket = biomeDirBuckets.get(t.biomeName) || {};
        bucket[dir] = (bucket[dir] || 0) + 1;
        biomeDirBuckets.set(t.biomeName, bucket);
      }
      const totalTiles = tiles.length || 1;
      const biomeSummary = Array.from(biomeCounts.entries())
        .map(([biomeName, count]) => {
          const dirs = biomeDirBuckets.get(biomeName) || {};
          const sortedDirs = Object.entries(dirs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([d]) => d);
          return {
            biomeName,
            proportion: count / totalTiles,
            predominantDirections: sortedDirs,
          };
        })
        .sort((a, b) => b.proportion - a.proportion)
        .slice(0, 6);
      tBiomeSummaryMs = Date.now() - tBiomeStart;

      // Settlements: leverage nearby from the center-with-nearby result
      const tSettlementsStart = Date.now();
      const nearby: NearbySettlement[] =
        (centerWithNearby?.nearbySettlements as NearbySettlement[]) || [];
      let visibleSettlements = nearby
        .filter(
          (s) => s.distance <= visibilityRadius * 1.2 || s.size === 'large',
        )
        .map((s) => ({
          name: s.name,
          type: s.type,
          size: s.size,
          distance: s.distance,
          direction: calculateDirection(player.x, player.y, s.x, s.y),
        }));

      // If we're standing in a settlement, include it explicitly as distance 0 at "here"
      const currentSettlement = centerWithNearby?.currentSettlement;
      if (
        currentSettlement?.name &&
        currentSettlement?.type &&
        currentSettlement?.size
      ) {
        const alreadyIncluded = visibleSettlements.some(
          (s) =>
            s.name === currentSettlement.name &&
            s.type === currentSettlement.type,
        );
        if (!alreadyIncluded) {
          visibleSettlements = [
            {
              name: currentSettlement.name,
              type: currentSettlement.type,
              size: currentSettlement.size,
              distance: 0,
              direction: 'here',
            },
            ...visibleSettlements,
          ];
        }
      }
      tSettlementsFilterMs = Date.now() - tSettlementsStart;

      // Compose a concise panoramic description
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
      // Build a descriptive paragraph; prefer AI if available for richer prose
      let description = [
        `From here you can see roughly ${visibilityRadius} tiles out across mostly ${
          topBiomes.join(' and ') || centerTile.biomeName
        }.`,
        peakLine,
        settleLine,
      ]
        .filter(Boolean)
        .join(' ');

      try {
        // Consider the player inside a settlement if the world service marks the current tile
        // as part of a settlement footprint (currentSettlement present), not just exact center.
        const inSettlement = Boolean(
          currentSettlement && currentSettlement.intensity > 0,
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
        const ai = await this.openaiService.getText(prompt, {
          timeoutMs: 1200, // keep latency tight; fallback if exceeded
          cacheKey: `look:${centerTile.x},${centerTile.y}:${visibilityRadius}:${topBiomes.join(',')}:${visiblePeaks
            .map((p) => p.direction)
            .join('/')}:${visibleSettlements
            .map((s) => `${s.type}-${s.direction}`)
            .join(
              '/',
            )}::${currentSettlement?.name ?? 'none'}:${inSettlement ? 'in' : 'out'}:${densityBucket}`,
          maxTokens: 120,
        });
        tAiMs = Date.now() - tAiStart;
        const aiText = (ai?.output_text ?? '').trim();
        if (aiText) description = aiText;
      } catch (e) {
        this.logger.debug('Panoramic AI description skipped or failed.');
      }

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf slackId=${slackId} totalMs=${totalMs} playerMs=${tPlayerMs} getCenterMs=${tGetCenterMs} getCenterNearbyMs=${tGetCenterNearbyMs} boundsTilesMs=${tBoundsTilesMs} filterTilesMs=${tFilterTilesMs} extBoundsMs=${tExtBoundsMs} peaksSortMs=${tPeaksSortMs} biomeSummaryMs=${tBiomeSummaryMs} settlementsFilterMs=${tSettlementsFilterMs} aiMs=${tAiMs} tiles=${tilesCount} peaks=${peaksCount}`,
      );

      return {
        success: true,
        data: {
          location: {
            x: centerTile.x,
            y: centerTile.y,
            biomeName: centerTile.biomeName,
            description: centerTile.description || '',
            height: centerTile.height,
            temperature: centerTile.temperature,
            moisture: centerTile.moisture,
          },
          visibilityRadius,
          biomeSummary,
          visiblePeaks,
          visibleSettlements,
          currentSettlement: currentSettlement
            ? {
                name: currentSettlement.name,
                type: currentSettlement.type,
                size: currentSettlement.size,
                intensity: currentSettlement.intensity,
                isCenter: currentSettlement.isCenter,
              }
            : undefined,
          inSettlement: Boolean(
            currentSettlement && currentSettlement.intensity > 0,
          ),
          description,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to build look view',
      };
    }
  }
}
