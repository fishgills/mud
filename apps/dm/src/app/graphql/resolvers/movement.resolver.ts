import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  Float,
} from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { WorldService } from '../../world/world.service';
import {
  PlayerMoveResponse,
  LookViewResponse,
  LookViewData,
  BiomeSectorSummary,
  VisiblePeakInfo,
  VisibleSettlementInfo,
  CurrentSettlementInfo,
  NearbyPlayerInfo,
} from '../types/response.types';
import { TileInfo } from '../models/tile-info.model';
import { Monster as GqlMonster } from '../models/monster.model';
import { MovePlayerInput } from '../inputs/player.input';
import {
  TimingMetrics,
  VisibilityService,
  DescriptionService,
  PeakService,
  BiomeService,
  SettlementService,
} from '../services';

@Resolver()
export class MovementResolver {
  private logger = new Logger(MovementResolver.name);

  constructor(
    private playerService: PlayerService,
    private worldService: WorldService,
    private visibilityService: VisibilityService,
  ) {}

  @Mutation(() => PlayerMoveResponse)
  async movePlayer(
    @Args('slackId') slackId: string,
    @Args('input') input: MovePlayerInput,
  ): Promise<PlayerMoveResponse> {
    try {
      const player = await this.playerService.movePlayer(slackId, input);
      const [playersAtLocation] = await Promise.all([
        this.playerService.getPlayersAtLocation(player.x, player.y),
      ]);

      this.logger.debug(`Moved to (${player.x}, ${player.y})`);
      return { success: true, player, monsters: [], playersAtLocation };
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

      // Assemble a parent object for field resolvers to use (not part of the GraphQL schema)
      const data: any = {
        // Internal context for @ResolveField methods
        _ctx: {
          slackId,
          player,
          centerWithNearby,
          centerTile,
          visibilityRadius,
          timing,
        },
      };

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf slackId=${slackId} totalMs=${totalMs} playerMs=${timing.tPlayerMs} getCenterMs=${timing.tGetCenterMs} getCenterNearbyMs=${timing.tGetCenterNearbyMs} boundsTilesMs=${timing.tBoundsTilesMs} filterTilesMs=${timing.tFilterTilesMs} extBoundsMs=${timing.tExtBoundsMs} peaksSortMs=${timing.tPeaksSortMs} biomeSummaryMs=${timing.tBiomeSummaryMs} settlementsFilterMs=${timing.tSettlementsFilterMs} aiMs=${timing.tAiMs} tiles=${timing.tilesCount} peaks=${timing.peaksCount}`,
      );

      return {
        success: true,
        data,
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

// Field resolvers for LookViewData
@Resolver(() => LookViewData)
export class LookViewDataResolver {
  constructor(
    private descriptionService: DescriptionService,
    private visibilityService: VisibilityService,
    private peakService: PeakService,
    private biomeService: BiomeService,
    private settlementService: SettlementService,
    private playerService: PlayerService,
  ) {}

  @ResolveField(() => TileInfo, { name: 'location' })
  async location(@Parent() parent: any) {
    const ctx = parent._ctx;
    const tile = ctx.centerTile;
    return {
      x: tile.x,
      y: tile.y,
      biomeName: tile.biomeName,
      description: tile.description || '',
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
    };
  }

  @ResolveField(() => Float)
  visibilityRadius(@Parent() parent: any) {
    return parent._ctx.visibilityRadius;
  }

  @ResolveField(() => [BiomeSectorSummary])
  biomeSummary(@Parent() parent: any) {
    const memo = (parent._memo ||= {});
    if (!memo.biomeSummary) {
      const { player, timing } = parent._ctx;
      const tiles = this.visibilityService.processTileData(
        player,
        parent._ctx.visibilityRadius,
        timing,
      );
      // processTileData can be async; support both
      memo.biomeSummary = Promise.resolve(tiles).then(({ tiles }) =>
        this.biomeService.generateBiomeSummary(player, tiles, timing),
      );
    }
    return memo.biomeSummary;
  }

  @ResolveField(() => [VisiblePeakInfo])
  visiblePeaks(@Parent() parent: any) {
    const memo = (parent._memo ||= {});
    if (!memo.visiblePeaks) {
      const { player, timing } = parent._ctx;
      const tilesP = this.visibilityService.processTileData(
        player,
        parent._ctx.visibilityRadius,
        timing,
      );
      memo.visiblePeaks = Promise.resolve(tilesP).then(({ extTiles }) =>
        this.peakService.processVisiblePeaks(
          player,
          parent._ctx.visibilityRadius,
          extTiles,
          timing,
        ),
      );
    }
    return memo.visiblePeaks;
  }

  @ResolveField(() => [VisibleSettlementInfo])
  visibleSettlements(@Parent() parent: any) {
    const memo = (parent._memo ||= {});
    if (!memo.visibleSettlements) {
      const { player, timing } = parent._ctx;
      const centerWithNearby = parent._ctx.centerWithNearby;
      memo.visibleSettlements =
        this.settlementService.processVisibleSettlements(
          player,
          parent._ctx.visibilityRadius,
          centerWithNearby,
          timing,
        );
    }
    return memo.visibleSettlements;
  }

  @ResolveField(() => CurrentSettlementInfo, { nullable: true })
  currentSettlement(@Parent() parent: any) {
    const current = parent._ctx.centerWithNearby?.currentSettlement;
    if (!current) return undefined;
    return {
      name: current.name,
      type: current.type,
      size: current.size,
      intensity: current.intensity,
      isCenter: current.isCenter,
    };
  }

  @ResolveField(() => [NearbyPlayerInfo], { nullable: true })
  nearbyPlayers(@Parent() parent: any) {
    const memo = (parent._memo ||= {});
    if (!memo.nearbyPlayers) {
      const { player } = parent._ctx;
      memo.nearbyPlayers = this.playerService.getNearbyPlayers(
        player.x,
        player.y,
        parent._ctx.slackId,
      );
    }
    return memo.nearbyPlayers;
  }

  @ResolveField(() => Boolean)
  inSettlement(@Parent() parent: any) {
    const current = parent._ctx.centerWithNearby?.currentSettlement;
    return Boolean(current && current.intensity > 0);
  }

  @ResolveField(() => String)
  async description(@Parent() parent: any) {
    const ctx = parent._ctx;
    const currentSettlement = ctx.centerWithNearby?.currentSettlement;
    const [biomeSummary, visiblePeaks, visibleSettlements, nearbyPlayers] =
      await Promise.all([
        this.biomeSummary(parent),
        this.visiblePeaks(parent),
        this.visibleSettlements(parent),
        this.nearbyPlayers(parent),
      ]);
    return this.descriptionService.generateAiDescription(
      ctx.centerTile,
      ctx.visibilityRadius,
      biomeSummary,
      visiblePeaks,
      visibleSettlements,
      currentSettlement,
      ctx.timing,
      nearbyPlayers,
    );
  }

  @ResolveField(() => [GqlMonster], { nullable: true, name: 'monsters' })
  monsters(@Parent() parent: any) {
    return parent._ctx.monsters ?? [];
  }
}
