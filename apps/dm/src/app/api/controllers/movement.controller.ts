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
import { MonsterService } from '../../monster/monster.service';
import type {
  PlayerMoveResponse,
  LookViewResponse,
  PerformanceStats,
  SniffResponse,
  TeleportResponse,
} from '../dto/responses.dto';
import type { Player } from '@mud/database';
import type { MovePlayerRequest } from '../dto/player-requests.dto';
import {
  TimingMetrics,
  VisibilityService,
  PeakService,
  BiomeService,
  DescriptionService,
  ResponseService,
} from '../services';
import { getPrismaClient } from '@mud/database';
import { calculateDirection } from '../../shared/direction.util';
import { env } from '../../../env';
import { EventBus } from '../../../shared/event-bus';

type HqAwarePlayer = Player & {
  isInHq?: boolean | null;
  lastWorldX?: number | null;
  lastWorldY?: number | null;
};

@Controller('movement')
export class MovementController {
  private readonly logger = new Logger(MovementController.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly worldService: WorldService,
    private readonly visibilityService: VisibilityService,
    private readonly peakService: PeakService,
    private readonly biomeService: BiomeService,
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

  private recordPlayerActivity(
    playerId: number,
    source: string,
    context: {
      teamId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): void {
    EventBus.emit({
      eventType: 'player:activity',
      playerId,
      teamId: context.teamId,
      userId: context.userId,
      source,
      metadata: context.metadata,
      timestamp: new Date(),
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to emit player activity for player ${playerId} from ${source}: ${message}`,
      );
    });
  }

  @Get('sniff')
  async sniffNearestMonster(
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ): Promise<SniffResponse> {
    try {
      const player = await this.playerService.getPlayer(teamId, userId);

      if (player) {
        this.recordPlayerActivity(player.id, 'movement:sniff', {
          teamId,
          userId,
        });
      }

      const agility = player.agility ?? 0;
      const detectionRadius = Math.max(1, agility);

      const nearest = await this.monsterService.findNearestMonsterWithinRadius(
        player.x,
        player.y,
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

      const direction = calculateDirection(
        player.x,
        player.y,
        nearest.monster.x,
        nearest.monster.y,
      );
      const distanceDescriptor = this.describeDistance(nearest.distance);
      const directionFragment = direction ? ` to the ${direction}` : '';

      return {
        success: true,
        data: {
          detectionRadius,
          monsterName: nearest.monster.name,
          direction,
          monsterX: nearest.monster.x,
          monsterY: nearest.monster.y,
          proximity: distanceDescriptor.proximity,
          distanceLabel: distanceDescriptor.label,
        },
        message: `You catch the scent of ${nearest.monster.name} ${distanceDescriptor.phrase}${directionFragment}.`,
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
      userId: string;
      teamId: string;
      move: MovePlayerRequest;
    },
  ): Promise<PlayerMoveResponse> {
    if (!input.userId || !input.teamId) {
      throw new BadRequestException('userId and teamId are required');
    }

    if (!input?.move) {
      throw new BadRequestException('move payload is required');
    }

    try {
      const player = await this.playerService.movePlayer(
        input.teamId,
        input.userId,
        input.move,
      );
      const [monsters, playersAtLocation] = await Promise.all([
        this.monsterService.getMonstersAtLocation(player.x, player.y),
        this.playerService.getPlayersAtLocation(player.x, player.y, {
          excludePlayerId: player.id,
        }),
      ]);

      this.logger.debug(`Moved ${player.name} to (${player.x}, ${player.y})`);
      return {
        success: true,
        player,
        monsters: monsters ?? [],
        playersAtLocation: playersAtLocation ?? [],
      };
    } catch (error) {
      const fallbackPlayer = await this.playerService
        .getPlayer(input.teamId, input.userId)
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
        player: fallbackPlayer,
        monsters: [],
        playersAtLocation: [],
      };
    }
  }

  @Get('look')
  async getLookView(
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ): Promise<LookViewResponse> {
    if (!userId || !teamId) {
      throw new BadRequestException('userId and teamId are required');
    }

    try {
      const aiProvider = env.DM_USE_VERTEX_AI ? 'vertex' : 'openai';
      this.logger.debug(
        `getLookView start teamId=${teamId} userId=${userId} provider=${aiProvider}`,
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
        tAiMs: 0,
        tilesCount: 0,
        peaksCount: 0,
      };

      const tPlayerStart = Date.now();
      const basePlayer = await this.playerService.getPlayer(teamId, userId);
      const player = basePlayer as HqAwarePlayer;
      this.recordPlayerActivity(player.id, 'movement:look', {
        teamId,
        userId,
      });
      timing.tPlayerMs = Date.now() - tPlayerStart;

      if (player.isInHq) {
        const totalMs = Date.now() - t0;
        return {
          success: true,
          message:
            'You are within the HQ safe zone. Use the teleport command to return to the world when ready.',
          data: {
            location: {
              x: player.lastWorldX ?? player.x,
              y: player.lastWorldY ?? player.y,
              biomeName: 'hq',
              description:
                'The headquarters hums with quiet activity. Vendors restock shelves while a town crier practices announcements.',
              height: 0,
              temperature: 0.5,
              moisture: 0.5,
            },
            visibilityRadius: 0,
            biomeSummary: [],
            visiblePeaks: [],
            nearbyPlayers: [],
            monsters: [],
            items: [],
            description:
              'You stand inside the Adventurers HQ—a fortified hub with vendors, rest areas, and a teleportation portal leading back to the wilds.',
          },
          perf: {
            totalMs,
            playerMs: timing.tPlayerMs,
            worldCenterNearbyMs: 0,
            worldBoundsTilesMs: 0,
            worldExtendedBoundsMs: 0,
            tilesFilterMs: 0,
            peaksSortMs: 0,
            biomeSummaryMs: 0,
            aiMs: 0,
            tilesCount: 0,
            peaksCount: 0,
            aiProvider,
          },
        } satisfies LookViewResponse;
      }

      const tCenterNearbyStart = Date.now();
      const centerWithNearbyPromise = this.worldService
        .getTileInfoWithNearby(player.x, player.y)
        .then((data) => {
          timing.tGetCenterNearbyMs = Date.now() - tCenterNearbyStart;
          return data;
        })
        .catch(() => null);

      const peakScanUpperBound = 18;
      const tExtPrefetchStart = Date.now();
      const extTilesPrefetchPromise = this.worldService.getTilesInBounds(
        player.x - peakScanUpperBound,
        player.x + peakScanUpperBound,
        player.y - peakScanUpperBound,
        player.y + peakScanUpperBound,
      );

      const centerWithNearby = await centerWithNearbyPromise;
      const centerTile = centerWithNearby?.tile
        ? {
            x: centerWithNearby.tile.x,
            y: centerWithNearby.tile.y,
            biomeName: centerWithNearby.tile.biomeName,
            description: centerWithNearby.tile.description || '',
            height: centerWithNearby.tile.height,
            temperature: centerWithNearby.tile.temperature,
            moisture: centerWithNearby.tile.moisture,
          }
        : {
            x: player.x,
            y: player.y,
            biomeName: 'grassland',
            description: '',
            height: 0.5,
            temperature: 0.6,
            moisture: 0.5,
          };

      const visibilityRadius =
        this.visibilityService.calculateVisibilityRadius(centerTile);

      const { tiles, extTiles } = await this.visibilityService.processTileData(
        { x: player.x, y: player.y },
        visibilityRadius,
        timing,
        {
          extTilesPromise: extTilesPrefetchPromise,
          tExtStart: tExtPrefetchStart,
        },
      );

      const visiblePeaks = this.peakService.processVisiblePeaks(
        { x: player.x, y: player.y },
        visibilityRadius,
        extTiles,
        timing,
      );

      const biomeSummary = this.biomeService.generateBiomeSummary(
        { x: player.x, y: player.y },
        tiles,
        timing,
      );

      const nearbyPlayersPromise = this.playerService.getNearbyPlayers(
        player.x,
        player.y,
        teamId,
        userId,
      );

      const monstersPromise = this.monsterService.getMonstersAtLocation(
        player.x,
        player.y,
      );

      const [nearbyPlayers, monsters] = await Promise.all([
        nearbyPlayersPromise,
        monstersPromise,
      ]);

      const description = await this.descriptionService.generateAiDescription(
        centerTile,
        visibilityRadius,
        biomeSummary,
        visiblePeaks,
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
          where: { x: player.x, y: player.y },
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
        description,
        nearbyPlayers,
        monsters,
        items,
      );

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf teamId=${teamId} userId=${userId} totalMs=${totalMs} playerMs=${timing.tPlayerMs} getCenterNearbyMs=${timing.tGetCenterNearbyMs} boundsTilesMs=${timing.tBoundsTilesMs} filterTilesMs=${timing.tFilterTilesMs} extBoundsMs=${timing.tExtBoundsMs} peaksSortMs=${timing.tPeaksSortMs} biomeSummaryMs=${timing.tBiomeSummaryMs} aiMs=${timing.tAiMs} tiles=${timing.tilesCount} peaks=${timing.peaksCount}`,
      );
      try {
        const perfPayload = {
          event: 'getLookView.perf',
          provider: aiProvider,
          totalMs,
          playerMs: timing.tPlayerMs,
          worldCenterNearbyMs: timing.tGetCenterNearbyMs,
          worldBoundsTilesMs: timing.tBoundsTilesMs,
          worldExtendedBoundsMs: timing.tExtBoundsMs,
          tilesFilterMs: timing.tFilterTilesMs,
          peaksSortMs: timing.tPeaksSortMs,
          biomeSummaryMs: timing.tBiomeSummaryMs,
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

  @Post('teleport')
  async teleport(
    @Body()
    input: {
      userId: string;
      teamId: string;
      mode?: 'return' | 'random';
    },
  ): Promise<TeleportResponse> {
    if (!input.userId || !input.teamId) {
      throw new BadRequestException('userId and teamId are required');
    }

    const result = await this.playerService.teleportPlayer(
      input.teamId,
      input.userId,
      input.mode,
    );

    const playerId = result.player?.id;
    if (playerId) {
      this.recordPlayerActivity(playerId, 'movement:teleport', {
        teamId: input.teamId,
        userId: input.userId,
        metadata: { mode: result.mode ?? result.state },
      });
    }

    switch (result.state) {
      case 'entered':
        return {
          success: true,
          state: 'entered',
          player: result.player,
          lastWorldPosition: result.lastWorldPosition,
          message:
            '✨ You arrive inside HQ. Your last world position has been saved for a quick return.',
        };
      case 'awaiting_choice':
        return {
          success: true,
          state: 'awaiting_choice',
          player: result.player,
          lastWorldPosition: result.lastWorldPosition,
          message:
            'You are already inside HQ. Choose `return` to go back to your last location or `random` for a fresh spawn.',
        };
      case 'exited':
      default:
        return {
          success: true,
          state: 'exited',
          player: result.player,
          destination: result.destination,
          mode: result.mode,
          message: `You depart HQ and arrive at (${result.destination?.x ?? '?'}, ${result.destination?.y ?? '?'})`,
        };
    }
  }
}
