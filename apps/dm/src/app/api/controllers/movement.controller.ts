import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { WorldService } from '../../world/world.service';
import type { Settlement } from '../../world/world.service';
import { MonsterService } from '../../monster/monster.service';
import type {
  PlayerMoveResponse,
  LookViewResponse,
  PerformanceStats,
  SniffResponse,
} from '../dto/responses.dto';
import type { MovePlayerRequest } from '../dto/player-requests.dto';
import {
  TimingMetrics,
  VisibilityService,
  PeakService,
  BiomeService,
  SettlementService,
  DescriptionService,
  ResponseService,
} from '../services';
import { EntityToDtoAdapter } from '../adapters/entity-to-dto.adapter';
import { calculateDirection } from '../../shared/direction.util';

@Controller('movement')
export class MovementController {
  private readonly logger = new Logger(MovementController.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly worldService: WorldService,
    private readonly visibilityService: VisibilityService,
    private readonly peakService: PeakService,
    private readonly biomeService: BiomeService,
    private readonly settlementService: SettlementService,
    private readonly descriptionService: DescriptionService,
    private readonly responseService: ResponseService,
    private readonly monsterService: MonsterService,
  ) {}

  @Get('sniff')
  async sniffNearestMonster(
    @Query('slackId') slackId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<SniffResponse> {
    if (!clientId && !slackId) {
      throw new BadRequestException(
        'Either clientId or slackId must be provided',
      );
    }

    try {
      const player = await this.playerService.getPlayerByIdentifier({
        clientId,
        slackId,
      });

      if (slackId) {
        this.playerService.updateLastAction(slackId).catch(() => {
          /* ignore activity errors */
        });
      }

      const agility = player.attributes.agility ?? 0;
      const detectionRadius = Math.max(1, agility);
      const nearest = await this.monsterService.findNearestMonsterWithinRadius(
        player.position.x,
        player.position.y,
        detectionRadius,
      );

      if (!nearest) {
        const radiusLabel =
          detectionRadius === 1 ? '1 tile' : `${detectionRadius} tiles`;
        return {
          success: true,
          message: `You sniff the air but can't catch any monster scent within ${radiusLabel}.`,
          data: {
            detectionRadius,
          },
        };
      }

      const roundedDistance = Math.round(nearest.distance * 10) / 10;
      const direction = calculateDirection(
        player.position.x,
        player.position.y,
        nearest.monster.position.x,
        nearest.monster.position.y,
      );

      return {
        success: true,
        data: {
          detectionRadius,
          monsterName: nearest.monster.name,
          distance: roundedDistance,
          direction,
          monsterX: nearest.monster.position.x,
          monsterY: nearest.monster.position.y,
        },
        message: `You catch the scent of ${nearest.monster.name} about ${roundedDistance} tiles ${direction}.`,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to sniff for monsters',
      };
    }
  }

  @Post('move')
  async movePlayer(
    @Body()
    input: {
      slackId?: string;
      clientId?: string;
      move: MovePlayerRequest;
    },
  ): Promise<PlayerMoveResponse> {
    const playerIdentifier = input?.clientId || input?.slackId;
    if (!playerIdentifier) {
      throw new BadRequestException(
        'Either clientId or slackId must be provided',
      );
    }
    if (!input?.move) {
      throw new BadRequestException('move payload is required');
    }

    try {
      const player = await this.playerService.movePlayer(
        playerIdentifier,
        input.move,
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
        player: EntityToDtoAdapter.playerEntityToDto(player),
        monsters: EntityToDtoAdapter.monsterEntitiesToDto(monsters ?? []),
        playersAtLocation: EntityToDtoAdapter.playerEntitiesToDto(
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
        player: EntityToDtoAdapter.playerEntityToDto(fallbackPlayer),
        monsters: [],
        playersAtLocation: [],
      };
    }
  }

  @Get('look')
  async getLookView(
    @Query('slackId') slackId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<LookViewResponse> {
    const playerIdentifier = clientId || slackId;
    if (!playerIdentifier) {
      throw new BadRequestException(
        'Either clientId or slackId must be provided',
      );
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

      const tPlayerStart = Date.now();
      const player = await this.playerService.getPlayer(playerIdentifier);
      this.playerService.updateLastAction(playerIdentifier).catch(() => {
        /* ignore */
      });
      timing.tPlayerMs = Date.now() - tPlayerStart;

      const tCenterNearbyStart = Date.now();
      const centerWithNearbyPromise = this.worldService
        .getTileInfoWithNearby(player.position.x, player.position.y)
        .then((d) => {
          timing.tGetCenterNearbyMs = Date.now() - tCenterNearbyStart;
          return d;
        })
        .catch(() => null);

      const peakScanUpperBound = 18;
      const tExtPrefetchStart = Date.now();
      const extTilesPrefetchPromise = this.worldService.getTilesInBounds(
        player.position.x - peakScanUpperBound,
        player.position.x + peakScanUpperBound,
        player.position.y - peakScanUpperBound,
        player.position.y + peakScanUpperBound,
      );

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

      const visibilityRadius =
        this.visibilityService.calculateVisibilityRadius(centerTile);

      const { tiles, extTiles } = await this.visibilityService.processTileData(
        { x: player.position.x, y: player.position.y },
        visibilityRadius,
        timing,
        {
          extTilesPromise: extTilesPrefetchPromise,
          tExtStart: tExtPrefetchStart,
        },
      );

      const visiblePeaks = this.peakService.processVisiblePeaks(
        { x: player.position.x, y: player.position.y },
        visibilityRadius,
        extTiles,
        timing,
      );

      const biomeSummary = this.biomeService.generateBiomeSummary(
        { x: player.position.x, y: player.position.y },
        tiles,
        timing,
      );

      const nearbyPlayersPromise = this.playerService.getNearbyPlayers(
        player.position.x,
        player.position.y,
        slackId,
      );
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
      );

      const responseData = this.responseService.buildResponseData(
        centerTile,
        visibilityRadius,
        biomeSummary,
        visiblePeaks,
        visibleSettlements,
        currentSettlement,
        description,
        nearbyPlayers,
        EntityToDtoAdapter.monsterEntitiesToDto(monsters),
      );

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf slackId=${slackId} totalMs=${totalMs} playerMs=${timing.tPlayerMs} getCenterMs=${timing.tGetCenterMs} getCenterNearbyMs=${timing.tGetCenterNearbyMs} boundsTilesMs=${timing.tBoundsTilesMs} filterTilesMs=${timing.tFilterTilesMs} extBoundsMs=${timing.tExtBoundsMs} peaksSortMs=${timing.tPeaksSortMs} biomeSummaryMs=${timing.tBiomeSummaryMs} settlementsFilterMs=${timing.tSettlementsFilterMs} aiMs=${timing.tAiMs} tiles=${timing.tilesCount} peaks=${timing.peaksCount}`,
      );
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
      this.logger.error('Failed to build look view', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to build view',
      };
    }
  }
}
