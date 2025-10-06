import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { WorldService } from '../../world/world.service';
import type { Settlement } from '../../world/world.service';
import {
  PlayerMoveResponse,
  LookViewResponse,
  PerformanceStats,
} from '../types/response.types';
import { MovePlayerInput } from '../inputs/player.input';
import {
  TimingMetrics,
  VisibilityService,
  PeakService,
  BiomeService,
  SettlementService,
  DescriptionService,
  ResponseService,
} from '../services';
import { MonsterService } from '../../monster/monster.service';
import { EntityToGraphQLAdapter } from '../adapters/entity-to-graphql.adapter';

@Resolver()
export class MovementResolver {
  private logger = new Logger(MovementResolver.name);

  constructor(
    private playerService: PlayerService,
    private worldService: WorldService,
    private visibilityService: VisibilityService,
    private peakService: PeakService,
    private biomeService: BiomeService,
    private settlementService: SettlementService,
    private descriptionService: DescriptionService,
    private responseService: ResponseService,
    private monsterService: MonsterService,
  ) {}

  @Mutation(() => PlayerMoveResponse)
  async movePlayer(
    @Args('input') input: MovePlayerInput,
    @Args('slackId', { nullable: true }) slackId?: string,
    @Args('clientId', { nullable: true }) clientId?: string,
  ): Promise<PlayerMoveResponse> {
    // Use clientId or fallback to slackId
    const playerIdentifier = clientId || slackId;
    if (!playerIdentifier) {
      throw new Error('Either clientId or slackId must be provided');
    }

    try {
      const player = await this.playerService.movePlayer(
        playerIdentifier,
        input,
      );
      const [monsters, playersAtLocation] = await Promise.all([
        this.monsterService.getMonstersAtLocation(
          player.position.x,
          player.position.y,
        ),
        this.playerService.getPlayersAtLocation(
          player.position.x,
          player.position.y,
          { excludePlayerId: player.id },
        ),
      ]);

      this.logger.debug(
        `Moved to (${player.position.x}, ${player.position.y})`,
      );
      return {
        success: true,
        player: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
        monsters: EntityToGraphQLAdapter.monsterEntitiesToGraphQL(
          monsters ?? [],
        ),
        playersAtLocation: EntityToGraphQLAdapter.playerEntitiesToGraphQL(
          playersAtLocation ?? [],
        ),
      };
    } catch (error) {
      const fallbackPlayer = await this.playerService
        .getPlayer(playerIdentifier)
        .catch(() => null);

      if (!fallbackPlayer) {
        throw error instanceof Error
          ? error
          : new Error('Failed to move player');
      }

      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to move player',
        player: EntityToGraphQLAdapter.playerEntityToGraphQL(fallbackPlayer),
        monsters: [],
        playersAtLocation: [],
      };
    }
  }

  @Query(() => LookViewResponse)
  async getLookView(
    @Args('slackId', { nullable: true }) slackId?: string,
    @Args('clientId', { nullable: true }) clientId?: string,
  ): Promise<LookViewResponse> {
    // Use clientId or fallback to slackId
    const playerIdentifier = clientId || slackId;
    if (!playerIdentifier) {
      throw new Error('Either clientId or slackId must be provided');
    }

    try {
      const aiProviderEnv = (process.env.DM_USE_VERTEX_AI || '').toLowerCase();
      const aiProvider = aiProviderEnv === 'true' ? 'vertex' : 'openai';
      this.logger.debug(
        `getLookView start identifier=${playerIdentifier} provider=${aiProvider}`,
      );
      const t0 = Date.now();
      const timing: TimingMetrics = {
        tPlayerMs: 0,
        tGetCenterMs: 0,
        tGetCenterNearbyMs: 0,
        tBoundsTilesMs: 0,
        tExtBoundsMs: 0,
        tFilterTilesMs: 0,
        tPeaksSortMs: 0,
        tBiomeSummaryMs: 0,
        tSettlementsFilterMs: 0,
        tAiMs: 0,
        tilesCount: 0,
        peaksCount: 0,
      };

      // Get player and center tile data
      const tPlayerStart = Date.now();
      const player = await this.playerService.getPlayer(playerIdentifier);

      // Update lastAction for activity tracking (fire and forget)
      this.playerService.updateLastAction(playerIdentifier).catch(() => {
        // Ignore errors - activity tracking shouldn't block the request
      });

      timing.tPlayerMs = Date.now() - tPlayerStart;

      // Start center-with-nearby immediately (single request for center + nearby)
      const tCenterNearbyStart = Date.now();
      const centerWithNearbyPromise = this.worldService
        .getTileInfoWithNearby(player.position.x, player.position.y)
        .then((d) => {
          timing.tGetCenterNearbyMs = Date.now() - tCenterNearbyStart;
          return d;
        })
        .catch(() => null);

      // In parallel, prefetch an upper-bound extended tile window so chunk fetches overlap
      // Visibility radius is clamped to [3,12], so peak scan radius maxes at ~18
      const peakScanUpperBound = 18;
      const tExtPrefetchStart = Date.now();
      const extTilesPrefetchPromise = this.worldService.getTilesInBounds(
        player.position.x - peakScanUpperBound,
        player.position.x + peakScanUpperBound,
        player.position.y - peakScanUpperBound,
        player.position.y + peakScanUpperBound,
      );

      // Await center data and compute dynamic visibility
      const centerWithNearby = await centerWithNearbyPromise;
      const centerTile = ((): {
        x: number;
        y: number;
        biomeName: string;
        description: string;
        height: number;
        temperature: number;
        moisture: number;
      } => {
        const t = centerWithNearby?.tile;
        if (t) {
          return {
            x: t.x,
            y: t.y,
            biomeName: t.biomeName,
            description: t.description || '',
            height: t.height,
            temperature: t.temperature,
            moisture: t.moisture,
          };
        }
        return {
          x: player.position.x,
          y: player.position.y,
          biomeName: 'grassland',
          description: '',
          height: 0.5,
          temperature: 0.6,
          moisture: 0.5,
        };
      })();

      // Calculate visibility radius based on tile height
      const visibilityRadius =
        this.visibilityService.calculateVisibilityRadius(centerTile);

      // Process tile data within visibility bounds
      const { tiles, extTiles } = await this.visibilityService.processTileData(
        { x: player.position.x, y: player.position.y },
        visibilityRadius,
        timing,
        {
          extTilesPromise: extTilesPrefetchPromise,
          tExtStart: tExtPrefetchStart,
        },
      );

      // Process visible peaks
      const visiblePeaks = this.peakService.processVisiblePeaks(
        { x: player.position.x, y: player.position.y },
        visibilityRadius,
        extTiles,
        timing,
      );

      // Generate biome summary
      const biomeSummary = this.biomeService.generateBiomeSummary(
        { x: player.position.x, y: player.position.y },
        tiles,
        timing,
      );

      // Kick off nearby players and monsters fetch concurrently
      const nearbyPlayersPromise = this.playerService.getNearbyPlayers(
        player.position.x,
        player.position.y,
        slackId,
      );
      // Process visible settlements
      const visibleSettlements =
        this.settlementService.processVisibleSettlements(
          { x: player.position.x, y: player.position.y },
          visibilityRadius,
          centerWithNearby,
          timing,
        );

      const monstersPromise = this.monsterService.getMonstersAtLocation(
        player.position.x,
        player.position.y,
      );

      // Generate description (AI-enhanced or fallback)
      const currentSettlement: Settlement | null =
        centerWithNearby?.currentSettlement
          ? {
              name: centerWithNearby.currentSettlement.name,
              type: centerWithNearby.currentSettlement.type,
              size: centerWithNearby.currentSettlement.size,
              intensity: centerWithNearby.currentSettlement.intensity,
              isCenter: Boolean(centerWithNearby.currentSettlement.isCenter),
            }
          : null;
      const [nearbyPlayers, monsters] = await Promise.all([
        nearbyPlayersPromise,
        monstersPromise,
      ]);

      const description = await this.descriptionService.generateAiDescription(
        centerTile,
        visibilityRadius,
        biomeSummary,
        visiblePeaks,
        visibleSettlements,
        currentSettlement,
        timing,
        nearbyPlayers,
      );

      // Build response data
      const responseData = this.responseService.buildResponseData(
        centerTile,
        visibilityRadius,
        biomeSummary,
        visiblePeaks,
        visibleSettlements,
        currentSettlement,
        description,
        nearbyPlayers,
        EntityToGraphQLAdapter.monsterEntitiesToGraphQL(monsters),
      );

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf slackId=${slackId} totalMs=${totalMs} playerMs=${timing.tPlayerMs} getCenterMs=${timing.tGetCenterMs} getCenterNearbyMs=${timing.tGetCenterNearbyMs} boundsTilesMs=${timing.tBoundsTilesMs} filterTilesMs=${timing.tFilterTilesMs} extBoundsMs=${timing.tExtBoundsMs} peaksSortMs=${timing.tPeaksSortMs} biomeSummaryMs=${timing.tBiomeSummaryMs} settlementsFilterMs=${timing.tSettlementsFilterMs} aiMs=${timing.tAiMs} tiles=${timing.tilesCount} peaks=${timing.peaksCount}`,
      );
      // Structured log for easy parsing in logs backends
      try {
        const perfPayload = {
          event: 'getLookView.perf',
          slackId,
          provider: aiProvider,
          totalMs,
          playerMs: timing.tPlayerMs,
          worldCenterNearbyMs: timing.tGetCenterNearbyMs,
          worldBoundsTilesMs: timing.tBoundsTilesMs,
          worldExtendedBoundsMs: timing.tExtBoundsMs,
          tilesFilterMs: timing.tFilterTilesMs,
          peaksSortMs: timing.tPeaksSortMs,
          biomeSummaryMs: timing.tBiomeSummaryMs,
          settlementsFilterMs: timing.tSettlementsFilterMs,
          aiMs: timing.tAiMs,
          tilesCount: timing.tilesCount,
          peaksCount: timing.peaksCount,
        };
        this.logger.log(JSON.stringify(perfPayload));
      } catch {
        this.logger.debug('Failed to emit structured perf log');
      }
      const perf: PerformanceStats = {
        totalMs,
        playerMs: timing.tPlayerMs,
        worldCenterNearbyMs: timing.tGetCenterNearbyMs,
        worldBoundsTilesMs: timing.tBoundsTilesMs,
        worldExtendedBoundsMs: timing.tExtBoundsMs,
        tilesFilterMs: timing.tFilterTilesMs,
        peaksSortMs: timing.tPeaksSortMs,
        biomeSummaryMs: timing.tBiomeSummaryMs,
        settlementsFilterMs: timing.tSettlementsFilterMs,
        aiMs: timing.tAiMs,
        tilesCount: timing.tilesCount,
        peaksCount: timing.peaksCount,
        aiProvider,
      };

      return {
        success: true,
        data: responseData,
        perf,
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
