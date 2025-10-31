import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { WORLD_CHUNK_SIZE } from '@mud/constants';
import { PlayerService } from '../../player/player.service';
import { WorldService } from '../../world/world.service';
import type { NearbySettlement, Settlement } from '../../world/world.service';
import { MonsterService } from '../../monster/monster.service';
import type {
  PlayerMoveResponse,
  LookViewResponse,
  PerformanceStats,
  SniffResponse,
  SniffProximity,
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
import { getPrismaClient } from '@mud/database';
import { calculateDirection } from '../../shared/direction.util';
import { env } from '../../../env';

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

  private describeDistance(distance: number | undefined | null): {
    proximity: 'immediate' | 'close' | 'near' | 'far' | 'distant' | 'unknown';
    phrase: string;
    label: string;
  } {
    if (typeof distance !== 'number' || !Number.isFinite(distance)) {
      return { proximity: 'unknown', phrase: 'nearby', label: 'nearby' };
    }

    if (distance <= 0.75) {
      return {
        proximity: 'immediate',
        phrase: 'right under your nose',
        label: 'right under your nose',
      };
    }

    if (distance <= 1.5) {
      return {
        proximity: 'close',
        phrase: 'very close',
        label: 'very close',
      };
    }

    if (distance <= 3.5) {
      return {
        proximity: 'near',
        phrase: 'nearby',
        label: 'nearby',
      };
    }

    if (distance <= 6.5) {
      return {
        proximity: 'far',
        phrase: 'a ways off',
        label: 'a ways off',
      };
    }

    return {
      proximity: 'distant',
      phrase: 'far off',
      label: 'far off',
    };
  }

  private resolveNearestSettlement(
    playerX: number,
    playerY: number,
    nearbySettlements: NearbySettlement[],
    currentSettlement?: Settlement,
  ): {
    name?: string;
    direction?: string;
    distance?: number;
    type?: string;
    size?: string;
    population?: number;
    description?: string | null;
    isCurrent: boolean;
    proximity?: SniffProximity;
    distanceLabel?: string;
  } | null {
    let nearest: {
      name?: string;
      direction?: string;
      distance?: number;
      type?: string;
      size?: string;
      population?: number;
      description?: string | null;
      isCurrent: boolean;
      proximity?: SniffProximity;
      distanceLabel?: string;
    } | null = null;

    const consider = (candidate: {
      name?: string;
      direction?: string;
      distance?: number;
      type?: string;
      size?: string;
      population?: number;
      description?: string | null;
      isCurrent: boolean;
    }) => {
      const candidateDistance =
        typeof candidate.distance === 'number' &&
        Number.isFinite(candidate.distance)
          ? candidate.distance
          : Number.POSITIVE_INFINITY;
      const currentDistance =
        nearest &&
        typeof nearest.distance === 'number' &&
        Number.isFinite(nearest.distance)
          ? nearest.distance
          : Number.POSITIVE_INFINITY;

      if (!nearest || candidateDistance < currentDistance) {
        const descriptor = Number.isFinite(candidateDistance)
          ? this.describeDistance(candidateDistance)
          : null;
        nearest = {
          ...candidate,
          distance: candidateDistance,
          proximity: descriptor?.proximity,
          distanceLabel: descriptor?.label,
        };
      }
    };

    if (currentSettlement?.name) {
      consider({
        name: currentSettlement.name,
        direction: 'here',
        distance: 0,
        isCurrent: true,
        type: currentSettlement.type,
        size: currentSettlement.size,
        description: null,
      });
    }

    for (const settlement of nearbySettlements ?? []) {
      const dx = settlement.x - playerX;
      const dy = settlement.y - playerY;
      const rawDistance =
        typeof settlement.distance === 'number' &&
        Number.isFinite(settlement.distance)
          ? settlement.distance
          : Math.sqrt(dx * dx + dy * dy);
      const direction =
        dx === 0 && dy === 0
          ? 'here'
          : calculateDirection(playerX, playerY, settlement.x, settlement.y);

      consider({
        name: settlement.name,
        direction,
        distance: rawDistance,
        isCurrent: dx === 0 && dy === 0,
        type: settlement.type,
        size: settlement.size,
        population: settlement.population,
        description: settlement.description,
      });
    }

    return nearest;
  }

  private describeNearestSettlement(
    settlement: {
      name?: string;
      direction?: string;
      distance?: number;
      isCurrent: boolean;
    } | null,
  ): string {
    if (!settlement || !settlement.direction) {
      return '';
    }

    const trimmedName = settlement.name?.trim();
    if (settlement.direction === 'here') {
      if (trimmedName) {
        return `You're right in ${trimmedName}.`;
      }
      return `You're standing in a settlement.`;
    }

    const nameSegment = trimmedName ? `${trimmedName} ` : '';
    const descriptor =
      typeof settlement.distance === 'number' &&
      Number.isFinite(settlement.distance)
        ? this.describeDistance(settlement.distance)
        : null;
    const distancePhrase = descriptor?.phrase ?? 'nearby';
    return `The nearest settlement is ${nameSegment}${distancePhrase} to the ${settlement.direction}.`;
  }

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

      const [center, nearest] = await Promise.all([
        this.worldService.getTileInfoWithNearby(
          player.position.x,
          player.position.y,
        ),
        this.monsterService.findNearestMonsterWithinRadius(
          player.position.x,
          player.position.y,
          detectionRadius,
        ),
      ]);

      const settlementInfo = this.resolveNearestSettlement(
        player.position.x,
        player.position.y,
        center.nearbySettlements,
        center.currentSettlement,
      );
      let resolvedSettlement = settlementInfo;

      if (!resolvedSettlement) {
        const deterministic = await this.worldService
          .findNearestSettlement(player.position.x, player.position.y, {
            maxRadius: Math.max(detectionRadius * 2, WORLD_CHUNK_SIZE * 2),
          })
          .catch(() => null);

        if (deterministic) {
          const descriptor =
            typeof deterministic.distance === 'number' &&
            Number.isFinite(deterministic.distance)
              ? this.describeDistance(deterministic.distance)
              : null;

          resolvedSettlement = {
            name: deterministic.name,
            direction: deterministic.direction,
            distance: deterministic.distance,
            type: deterministic.type,
            size: deterministic.size,
            population: deterministic.population,
            description: deterministic.description,
            isCurrent: deterministic.isCurrent,
            proximity: descriptor?.proximity,
            distanceLabel: descriptor?.label,
          };
        }
      }

      const settlementSentence =
        this.describeNearestSettlement(resolvedSettlement);
      const settlementData = resolvedSettlement
        ? {
            nearestSettlementName: resolvedSettlement.name,
            nearestSettlementDirection: resolvedSettlement.direction,
            nearestSettlementDistance: resolvedSettlement.distance,
            nearestSettlementType: resolvedSettlement.type,
            nearestSettlementPopulation: resolvedSettlement.population,
            nearestSettlementDescription:
              resolvedSettlement.description ?? null,
            nearestSettlementIsCurrent: resolvedSettlement.isCurrent,
            nearestSettlementSize: resolvedSettlement.size,
            nearestSettlementDistanceLabel: resolvedSettlement.distanceLabel,
            nearestSettlementProximity: resolvedSettlement.proximity,
          }
        : {};

      if (!nearest) {
        const radiusLabel =
          detectionRadius === 1 ? '1 tile' : `${detectionRadius} tiles`;
        const messageParts = [
          `You sniff the air but can't catch any monster scent within ${radiusLabel}.`,
        ];
        if (settlementSentence) {
          messageParts.push(settlementSentence);
        }
        return {
          success: true,
          message: messageParts.join(' '),
          data: {
            detectionRadius,
            ...settlementData,
          },
        };
      }

      const direction = calculateDirection(
        player.position.x,
        player.position.y,
        nearest.monster.position.x,
        nearest.monster.position.y,
      );
      const distanceDescriptor = this.describeDistance(nearest.distance);
      const directionFragment = direction ? ` to the ${direction}` : '';
      const messageParts = [
        `You catch the scent of ${nearest.monster.name} ${distanceDescriptor.phrase}${directionFragment}.`,
      ];
      if (settlementSentence) {
        messageParts.push(settlementSentence);
      }

      return {
        success: true,
        data: {
          detectionRadius,
          monsterName: nearest.monster.name,
          direction,
          monsterX: nearest.monster.position.x,
          monsterY: nearest.monster.position.y,
          proximity: distanceDescriptor.proximity,
          distanceLabel: distanceDescriptor.label,
          ...settlementData,
        },
        message: messageParts.join(' '),
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
      const aiProvider = env.DM_USE_VERTEX_AI ? 'vertex' : 'openai';
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

      // Also fetch any world items at the player's location and include their
      // item names where possible so the look view can show loot on the ground.
      const prisma = getPrismaClient();
      let items: Array<{
        id: number;
        itemId: number;
        quantity?: number;
        quality?: string | null;
        itemName?: string | null;
        x?: number;
        y?: number;
      }> = [];

      try {
        const worldItems = await prisma.worldItem.findMany({
          where: { x: player.position.x, y: player.position.y },
          include: { item: true },
        });
        items = worldItems.map((wi) => ({
          id: wi.id,
          itemId: wi.itemId,
          quantity: wi.quantity ?? 1,
          quality: wi.quality ?? null,
          itemName: wi.item ? (wi.item.name as string) : null,
          x: wi.x,
          y: wi.y,
        }));
      } catch (err) {
        // Non-fatal: if DB lookup fails, just omit items from response
        this.logger.warn(
          `Failed to load world items for look view: ${err instanceof Error ? err.message : err}`,
        );
        items = [];
      }

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
        items,
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
