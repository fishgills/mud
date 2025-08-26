import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { WorldService } from '../../world/world.service';
import { PlayerMoveResponse, LookViewResponse } from '../types/response.types';
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
      const player = await this.playerService.getPlayer(slackId);
      timing.tPlayerMs = Date.now() - tPlayerStart;

      // Start center-with-nearby immediately (single request for center + nearby)
      const tCenterNearbyStart = Date.now();
      const centerWithNearbyPromise = this.worldService
        .getTileInfoWithNearby(player.x, player.y)
        .then((d) => {
          timing.tGetCenterNearbyMs = Date.now() - tCenterNearbyStart;
          return d;
        })
        .catch(() => null as any);

      // Await center data and compute dynamic visibility
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

      // Calculate visibility radius based on tile height
      const visibilityRadius =
        this.visibilityService.calculateVisibilityRadius(centerTile);

      // Process tile data within visibility bounds
      const { tiles, extTiles } = await this.visibilityService.processTileData(
        player,
        visibilityRadius,
        timing,
      );

      // Process visible peaks
      const visiblePeaks = this.peakService.processVisiblePeaks(
        player,
        visibilityRadius,
        extTiles,
        timing,
      );

      // Generate biome summary
      const biomeSummary = this.biomeService.generateBiomeSummary(
        player,
        tiles,
        timing,
      );

      // Get NearbyPlayers
      const nearbyPlayers = await this.playerService.getNearbyPlayers(
        player.x,
        player.y,
        slackId,
      );
      // Process visible settlements
      const visibleSettlements =
        this.settlementService.processVisibleSettlements(
          player,
          visibilityRadius,
          centerWithNearby,
          timing,
        );

      const monsters = await this.monsterService.getMonstersAtLocation(
        player.x,
        player.y,
      );

      // Generate description (AI-enhanced or fallback)
      const currentSettlement = centerWithNearby?.currentSettlement;
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
        monsters,
      );

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf slackId=${slackId} totalMs=${totalMs} playerMs=${timing.tPlayerMs} getCenterMs=${timing.tGetCenterMs} getCenterNearbyMs=${timing.tGetCenterNearbyMs} boundsTilesMs=${timing.tBoundsTilesMs} filterTilesMs=${timing.tFilterTilesMs} extBoundsMs=${timing.tExtBoundsMs} peaksSortMs=${timing.tPeaksSortMs} biomeSummaryMs=${timing.tBiomeSummaryMs} settlementsFilterMs=${timing.tSettlementsFilterMs} aiMs=${timing.tAiMs} tiles=${timing.tilesCount} peaks=${timing.peaksCount}`,
      );

      return {
        success: true,
        data: responseData,
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
