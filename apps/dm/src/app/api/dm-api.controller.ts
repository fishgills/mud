import { Controller, Logger } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import {
  dmContract,
  type Player as ApiPlayer,
  type Monster as ApiMonster,
  type CombatResponse as ApiCombatResponse,
  type CombatResult as ApiCombatResult,
  type CombatLog as ApiCombatLog,
  type PlayerMoveResponse as ApiPlayerMoveResponse,
  type PlayerStatsResponse as ApiPlayerStatsResponse,
  type LookViewResponse as ApiLookViewResponse,
  type SniffResponse as ApiSniffResponse,
  type LocationResponse as ApiLocationResponse,
  type MonsterResponse as ApiMonsterResponse,
  type SuccessResponse as ApiSuccessResponse,
  type GameStateResponse as ApiGameStateResponse,
  type PlayerResponse as ApiPlayerResponse,
} from '@mud/api-contracts';
import { PlayerService } from '../player/player.service';
import { MonsterService } from '../monster/monster.service';
import { CombatService } from '../combat/combat.service';
import { GameTickService } from '../game-tick/game-tick.service';
import { WorldService, type WorldTile } from '../world/world.service';
import { EntityToApiAdapter } from './mappers/entity-to-api.adapter';
import { ResponseService } from '../look-view/response.service';
import { VisibilityService } from '../look-view/visibility.service';
import type { TimingMetrics } from '../look-view/look-view-types';
import { PeakService } from '../look-view/peak.service';
import { BiomeService } from '../look-view/biome.service';
import { SettlementService } from '../look-view/settlement.service';
import { DescriptionService } from '../look-view/description.service';
import { calculateDirection } from '../shared/direction.util';
import type { PlayerEntity } from '@mud/engine';
import type { CombatLog as PrismaCombatLog } from '@mud/database';

@Controller()
export class DmApiController {
  private readonly logger = new Logger(DmApiController.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly monsterService: MonsterService,
    private readonly combatService: CombatService,
    private readonly gameTickService: GameTickService,
    private readonly worldService: WorldService,
    private readonly visibilityService: VisibilityService,
    private readonly peakService: PeakService,
    private readonly biomeService: BiomeService,
    private readonly settlementService: SettlementService,
    private readonly descriptionService: DescriptionService,
    private readonly responseService: ResponseService,
  ) {}

  @TsRestHandler(dmContract.health)
  health() {
    return tsRestHandler(dmContract.health, async () => ({
      status: 200,
      body: {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
      },
    }));
  }

  private serializePlayer(entity: PlayerEntity): ApiPlayer {
    return EntityToApiAdapter.playerEntityToApi(entity);
}

private serializeMonsters(monsters: unknown[]): ApiMonster[] {
    return EntityToApiAdapter.monsterEntitiesToApi(
      monsters as Parameters<
        typeof EntityToApiAdapter.monsterEntitiesToApi
      >[0],
    );
  }

  private serializeTileInfo(tile: WorldTile | null | undefined) {
    if (!tile) {
      return null;
    }
    return {
      x: tile.x,
      y: tile.y,
      biomeName: tile.biomeName,
      description: tile.description ?? null,
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
    };
  }

  private serializeCombatLog(logs: PrismaCombatLog[]): ApiCombatLog[] {
    return logs.map((log) => ({
      id: Number(log.id),
      attackerId: Number(log.attackerId),
      attackerType: String(log.attackerType),
      defenderId: Number(log.defenderId),
      defenderType: String(log.defenderType),
      damage: Number(log.damage),
      x: Number(log.x),
      y: Number(log.y),
      timestamp:
        log.timestamp instanceof Date
          ? log.timestamp.toISOString()
          : new Date(log.timestamp).toISOString(),
      location: {
        x: Number(log.x),
        y: Number(log.y),
      },
    }));
  }

  private buildPlaceholderPlayer(identifier: string = 'unknown'): ApiPlayer {
    const [clientType, clientId] = identifier.includes(':')
      ? identifier.split(':', 2)
      : [null, identifier];
    const now = new Date().toISOString();
    return {
      id: 0,
      slackId: clientType === 'slack' ? clientId ?? null : identifier ?? null,
      clientId: identifier ?? null,
      clientType: clientType ?? null,
      name: 'Unknown Adventurer',
      x: 0,
      y: 0,
      hp: 0,
      maxHp: 0,
      strength: 0,
      agility: 0,
      health: 0,
      gold: 0,
      xp: 0,
      level: 1,
      skillPoints: 0,
      isAlive: true,
      lastAction: null,
      createdAt: now,
      updatedAt: now,
      worldTileId: null,
      currentTile: null,
      nearbyPlayers: [],
      nearbyMonsters: [],
    };
  }

  private successResponse<T extends { success: boolean }>(
    body: T,
    status = 200 as const,
  ) {
    return {
      status,
      body,
    };
  }

  @TsRestHandler(dmContract.createPlayer)
  createPlayer() {
    return tsRestHandler(dmContract.createPlayer, async ({ body }) => {
      try {
        const entity = await this.playerService.createPlayer({
          slackId: body.slackId ?? undefined,
          clientId: body.clientId ?? undefined,
          clientType: body.clientType,
          name: body.name,
          x: body.x,
          y: body.y,
        });

        return this.successResponse(
          {
            success: true,
            data: this.serializePlayer(entity),
          },
          201,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create player';
        this.logger.error('[DM-API] createPlayer failed', error);
        return this.successResponse(
          {
            success: false,
            message,
          },
          400,
        );
      }
    });
  }

  @TsRestHandler(dmContract.getPlayer)
  getPlayer() {
    return tsRestHandler(dmContract.getPlayer, async ({ query }) => {
      if (!query.slackId && !query.clientId && !query.name) {
        return this.successResponse<ApiPlayerResponse>(
          {
            success: false,
            message: 'A clientId, slackId, or player name must be provided',
          },
          400,
        );
      }

      const identifier =
        query.clientId ?? query.slackId ?? `name:${query.name ?? 'unknown'}`;

      try {
        const entity = await this.playerService.getPlayerByIdentifier({
          slackId: query.slackId,
          clientId: query.clientId,
          name: query.name,
        });

        return this.successResponse<ApiPlayerResponse>({
          success: true,
          data: this.serializePlayer(entity),
        });
      } catch (error) {
        this.logger.error(
          `[DM-API] getPlayer failed for identifier=${identifier}`,
          error instanceof Error ? error.stack : error,
        );
        return this.successResponse<ApiPlayerResponse>({
          success: false,
          message:
            error instanceof Error ? error.message : 'Player not found',
        });
      }
    });
  }

  @TsRestHandler(dmContract.getAllPlayers)
  getAllPlayers() {
    return tsRestHandler(dmContract.getAllPlayers, async () => {
      const players = await this.playerService.getAllPlayers();
      return {
        status: 200,
        body: players.map((player) => this.serializePlayer(player)),
      };
    });
  }

  @TsRestHandler(dmContract.updatePlayerStats)
  updatePlayerStats() {
    return tsRestHandler(dmContract.updatePlayerStats, async ({ body }) => {
      if (!body.slackId) {
        return this.successResponse<ApiPlayerResponse>(
          {
            success: false,
            message: 'slackId is required to update player stats',
          },
          400,
        );
      }

      try {
        const player = await this.playerService.updatePlayerStats(
          body.slackId,
          {
            hp: body.input.hp ?? undefined,
            xp: body.input.xp ?? undefined,
            gold: body.input.gold ?? undefined,
            level: body.input.level ?? undefined,
          },
        );

        return this.successResponse<ApiPlayerResponse>({
          success: true,
          data: this.serializePlayer(player),
        });
      } catch (error) {
        return this.successResponse<ApiPlayerResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update player stats',
        });
      }
    });
  }

  @TsRestHandler(dmContract.spendSkillPoint)
  spendSkillPoint() {
    return tsRestHandler(dmContract.spendSkillPoint, async ({ body }) => {
      if (!body.slackId) {
        return this.successResponse<ApiPlayerResponse>(
          {
            success: false,
            message: 'slackId is required to spend a skill point',
          },
          400,
        );
      }

      try {
        const player = await this.playerService.spendSkillPoint(
          body.slackId,
          body.attribute,
        );
        return this.successResponse<ApiPlayerResponse>({
          success: true,
          data: this.serializePlayer(player),
        });
      } catch (error) {
        return this.successResponse<ApiPlayerResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to spend skill point',
        });
      }
    });
  }

  @TsRestHandler(dmContract.rerollPlayerStats)
  rerollPlayerStats() {
    return tsRestHandler(dmContract.rerollPlayerStats, async ({ body }) => {
      if (!body.slackId) {
        return this.successResponse<ApiPlayerResponse>(
          {
            success: false,
            message: 'slackId is required to reroll player stats',
          },
          400,
        );
      }

      try {
        const player = await this.playerService.rerollPlayerStats(body.slackId);
        return this.successResponse<ApiPlayerResponse>({
          success: true,
          data: this.serializePlayer(player),
        });
      } catch (error) {
        return this.successResponse<ApiPlayerResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to reroll player stats',
        });
      }
    });
  }

  @TsRestHandler(dmContract.movePlayer)
  movePlayer() {
    return tsRestHandler(dmContract.movePlayer, async ({ body }) => {
      const playerIdentifier = body.clientId ?? body.slackId;
      if (!playerIdentifier) {
        return this.successResponse<ApiPlayerMoveResponse>(
          {
            success: false,
            message: 'Either clientId or slackId must be provided',
            player: this.buildPlaceholderPlayer(),
            monsters: [],
            playersAtLocation: [],
          },
          400,
        );
      }

      const moveDto = {
        direction: body.input.direction ?? undefined,
        distance: body.input.distance ?? undefined,
        x: body.input.x ?? undefined,
        y: body.input.y ?? undefined,
      };

      let startingPlayer: PlayerEntity;
      try {
        startingPlayer = await this.playerService.getPlayerByIdentifier({
          clientId: body.clientId,
          slackId: body.slackId,
        });
      } catch (error) {
        return this.successResponse<ApiPlayerMoveResponse>(
          {
            success: false,
            message:
              error instanceof Error ? error.message : 'Player not found',
            player: this.buildPlaceholderPlayer(playerIdentifier),
            monsters: [],
            playersAtLocation: [],
          },
          404,
        );
      }

      try {
        const player = await this.playerService.movePlayer(
          playerIdentifier,
          moveDto,
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

        return this.successResponse<ApiPlayerMoveResponse>({
          success: true,
          player: this.serializePlayer(player),
          monsters: this.serializeMonsters(monsters ?? []),
          playersAtLocation: EntityToApiAdapter.playerEntitiesToApi(
            playersAtLocation ?? [],
          ),
        });
      } catch (error) {
        return this.successResponse<ApiPlayerMoveResponse>({
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to move player',
          player: this.serializePlayer(startingPlayer),
          monsters: [],
          playersAtLocation: [],
        });
      }
    });
  }

  @TsRestHandler(dmContract.sniffNearestMonster)
  sniffNearestMonster() {
    return tsRestHandler(dmContract.sniffNearestMonster, async ({ query }) => {
      if (!query.clientId && !query.slackId) {
        return this.successResponse<ApiSniffResponse>(
          {
            success: false,
            message: 'Either clientId or slackId must be provided',
          },
          400,
        );
      }

      try {
        const player = await this.playerService.getPlayerByIdentifier({
          clientId: query.clientId,
          slackId: query.slackId,
        });

        if (query.slackId) {
          this.playerService.updateLastAction(query.slackId).catch(() => {
            /* ignore */
          });
        }

        const agility = player.attributes.agility ?? 0;
        const detectionRadius = Math.max(1, agility);
        const nearest =
          await this.monsterService.findNearestMonsterWithinRadius(
            player.position.x,
            player.position.y,
            detectionRadius,
          );

        if (!nearest) {
          const radiusLabel =
            detectionRadius === 1 ? '1 tile' : `${detectionRadius} tiles`;
          return this.successResponse<ApiSniffResponse>({
            success: true,
            message: `You sniff the air but can't catch any monster scent within ${radiusLabel}.`,
            data: {
              detectionRadius,
            },
          });
        }

        const roundedDistance = Math.round(nearest.distance * 10) / 10;
        const direction = calculateDirection(
          player.position.x,
          player.position.y,
          nearest.monster.position.x,
          nearest.monster.position.y,
        );

        return this.successResponse<ApiSniffResponse>({
          success: true,
          message: `You catch the scent of ${nearest.monster.name} about ${roundedDistance} tiles ${direction}.`,
          data: {
            detectionRadius,
            monsterName: nearest.monster.name,
            distance: roundedDistance,
            direction,
            monsterX: nearest.monster.position.x,
            monsterY: nearest.monster.position.y,
          },
        });
      } catch (error) {
        return this.successResponse<ApiSniffResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to sniff for monsters',
        });
      }
    });
  }

  @TsRestHandler(dmContract.attack)
  attack() {
    return tsRestHandler(dmContract.attack, async ({ body }) => {
      if (!body.slackId && !body.clientId) {
        return this.successResponse<ApiCombatResponse>(
          {
            success: false,
            message: 'Either clientId or slackId must be provided',
          },
          400,
        );
      }

      try {
        const attacker = await this.playerService.getPlayerByIdentifier({
          clientId: body.clientId,
          slackId: body.slackId,
        });

        const attackerId =
          body.slackId ?? attacker.clientId ?? attacker.slackId ?? '';
        if (!attackerId) {
          throw new Error('Attacker identifier is missing');
        }

        let result: ApiCombatResult | undefined;

        if (body.input.targetType === 'monster') {
          if (typeof body.input.targetId !== 'number') {
            throw new Error('targetId is required for monster attacks');
          }
          result = (await this.combatService.playerAttackMonster(
            attackerId,
            body.input.targetId,
          )) as ApiCombatResult;
        } else if (body.input.targetType === 'player') {
          let targetSlackId = body.input.targetSlackId ?? undefined;
          if (!targetSlackId) {
            if (typeof body.input.targetId === 'number') {
              const allPlayers = await this.playerService.getAllPlayers();
              const targetPlayer = allPlayers.find(
                (p) => p.id === body.input.targetId,
              );
              if (!targetPlayer) {
                throw new Error('Target player not found');
              }
              targetSlackId =
                targetPlayer.clientId || targetPlayer.slackId || undefined;
            } else {
              throw new Error(
                'Must provide targetSlackId or targetId for player attacks',
              );
            }
          }

          if (!targetSlackId) {
            throw new Error('Target player has no valid identifier');
          }

          const ignoreLocation = body.input.ignoreLocation === true;
          result = (await this.combatService.playerAttackPlayer(
            attackerId,
            targetSlackId,
            ignoreLocation,
          )) as ApiCombatResult;
        } else {
          throw new Error('Invalid target type');
        }

        return this.successResponse<ApiCombatResponse>({
          success: true,
          data: result,
        });
      } catch (error) {
        return this.successResponse<ApiCombatResponse>({
          success: false,
          message: error instanceof Error ? error.message : 'Attack failed',
        });
      }
    });
  }

  @TsRestHandler(dmContract.getPlayerStats)
  getPlayerStats() {
    return tsRestHandler(dmContract.getPlayerStats, async ({ query }) => {
      try {
        const player = await this.playerService.getPlayerByIdentifier({
          slackId: query.slackId,
          clientId: query.clientId,
          name: query.name,
        });

        const strength = player.attributes.strength ?? 0;
        const agility = player.attributes.agility ?? 0;
        const health = player.attributes.health ?? 0;

        const strengthModifier = Math.floor((strength - 10) / 2);
        const agilityModifier = Math.floor((agility - 10) / 2);
        const healthModifier = Math.floor((health - 10) / 2);
        const dodgeChance = Math.max(0, (agility - 10) * 5);
        const baseDamage = `1d6${strengthModifier >= 0 ? '+' : ''}${strengthModifier}`;
        const armorClass = 10 + agilityModifier;

        const xpThreshold = (lvl: number) => Math.floor(100 * (lvl * (lvl + 1)) / 2);
        const xpForNextLevel = xpThreshold(player.level);
        const prevThreshold = player.level > 1 ? xpThreshold(player.level - 1) : 0;
        const xpProgress = Math.max(0, player.xp - prevThreshold);
        const xpNeeded = Math.max(0, xpForNextLevel - player.xp);

        const recentCombatLogs = await this.combatService.getCombatLogForLocation(
          player.position.x,
          player.position.y,
        );

        const response: ApiPlayerStatsResponse = {
          success: true,
          data: {
            player: this.serializePlayer(player),
            strengthModifier,
            agilityModifier,
            healthModifier,
            dodgeChance,
            baseDamage,
            armorClass,
            xpForNextLevel,
            xpProgress,
            xpNeeded,
            recentCombat: this.serializeCombatLog(recentCombatLogs),
          },
        };

        return this.successResponse(response);
      } catch (error) {
        return this.successResponse<ApiPlayerStatsResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to get player stats',
        });
      }
    });
  }

  @TsRestHandler(dmContract.getLookView)
  getLookView() {
    return tsRestHandler(dmContract.getLookView, async ({ query }) => {
      const playerIdentifier = query.clientId ?? query.slackId;
      if (!playerIdentifier) {
        return this.successResponse<ApiLookViewResponse>(
          {
            success: false,
            message: 'Either clientId or slackId must be provided',
          },
          400,
        );
      }

      try {
        const aiProviderEnv = (process.env.DM_USE_VERTEX_AI || '').toLowerCase();
        const aiProvider = aiProviderEnv === 'true' ? 'vertex' : 'openai';
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
        const player = await this.playerService.getPlayerByIdentifier({
          clientId: query.clientId,
          slackId: query.slackId,
        });
        timing.tPlayerMs = Date.now() - tPlayerStart;

        const centerWithNearbyPromise = this.worldService
          .getTileInfoWithNearby(player.position.x, player.position.y)
          .then((data) => {
            timing.tGetCenterNearbyMs = Date.now() - tPlayerStart;
            return data;
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
        const centerTile = (() => {
          const tile = centerWithNearby?.tile;
          if (tile) {
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
          query.slackId ?? undefined,
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

        const currentSettlement = centerWithNearby?.currentSettlement
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

        const responseData = this.responseService.buildResponseData(
          centerTile,
          visibilityRadius,
          biomeSummary,
          visiblePeaks,
          visibleSettlements,
          currentSettlement,
          description,
          nearbyPlayers,
          EntityToApiAdapter.monsterEntitiesToApi(monsters ?? []),
        );

        const totalMs = Date.now() - t0;
        const perf = {
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

        return this.successResponse<ApiLookViewResponse>({
          success: true,
          data: responseData,
          perf,
        });
      } catch (error) {
        return this.successResponse<ApiLookViewResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to build look view',
        });
      }
    });
  }

  @TsRestHandler(dmContract.getLocationEntities)
  getLocationEntities() {
    return tsRestHandler(dmContract.getLocationEntities, async ({ query }) => {
      try {
        const [players, monsters, tile, recentCombat] = await Promise.all([
          this.playerService.getPlayersAtLocation(query.x, query.y),
          this.monsterService.getMonstersAtLocation(query.x, query.y),
          this.worldService.getTileInfo(query.x, query.y),
          this.combatService.getCombatLogForLocation(query.x, query.y),
        ]);

        const locationInfo =
          this.serializeTileInfo(tile) ?? {
            x: query.x,
            y: query.y,
            biomeName: 'unknown',
            description: null,
            height: 0,
            temperature: 0,
            moisture: 0,
          };

        return this.successResponse<ApiLocationResponse>({
          success: true,
          data: {
            location: locationInfo,
            players: EntityToApiAdapter.playerEntitiesToApi(players),
            monsters: this.serializeMonsters(monsters),
            recentCombat: this.serializeCombatLog(recentCombat),
          },
        });
      } catch (error) {
        return this.successResponse<ApiLocationResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to load location entities',
        });
      }
    });
  }

  @TsRestHandler(dmContract.getPlayerLocationDetails)
  getPlayerLocationDetails() {
    return tsRestHandler(dmContract.getPlayerLocationDetails, async ({ query }) => {
      const identifier = query.clientId ?? query.slackId;
      if (!identifier) {
        return this.successResponse<ApiLocationResponse>(
          {
            success: false,
            message: 'Either clientId or slackId must be provided',
          },
          400,
        );
      }

      try {
        const player = await this.playerService.getPlayerByIdentifier({
          clientId: query.clientId,
          slackId: query.slackId,
        });

        const [players, monsters, tile, recentCombat] = await Promise.all([
          this.playerService.getPlayersAtLocation(
            player.position.x,
            player.position.y,
          ),
          this.monsterService.getMonstersAtLocation(
            player.position.x,
            player.position.y,
          ),
          this.worldService.getTileInfo(player.position.x, player.position.y),
          this.combatService.getCombatLogForLocation(
            player.position.x,
            player.position.y,
          ),
        ]);

        const locationInfo =
          this.serializeTileInfo(tile) ?? {
            x: player.position.x,
            y: player.position.y,
            biomeName: 'unknown',
            description: null,
            height: 0,
            temperature: 0,
            moisture: 0,
          };

        return this.successResponse<ApiLocationResponse>({
          success: true,
          data: {
            location: locationInfo,
            players: EntityToApiAdapter.playerEntitiesToApi(players),
            monsters: this.serializeMonsters(monsters),
            recentCombat: this.serializeCombatLog(recentCombat),
          },
        });
      } catch (error) {
        return this.successResponse<ApiLocationResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to load player location',
        });
      }
    });
  }

  @TsRestHandler(dmContract.deletePlayer)
  deletePlayer() {
    return tsRestHandler(dmContract.deletePlayer, async ({ query }) => {
      if (!query.slackId) {
        return this.successResponse<ApiPlayerResponse>(
          {
            success: false,
            message: 'slackId is required to delete a player',
          },
          400,
        );
      }

      try {
        const player = await this.playerService.deletePlayer(query.slackId);
        return this.successResponse<ApiPlayerResponse>({
          success: true,
          data: this.serializePlayer(player),
          message: 'Player deleted successfully',
        });
      } catch (error) {
        return this.successResponse<ApiPlayerResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to delete player',
        });
      }
    });
  }

  @TsRestHandler(dmContract.processTick)
  processTick() {
    return tsRestHandler(dmContract.processTick, async () => {
      try {
        const result = await this.gameTickService.processTick();
        return this.successResponse<ApiSuccessResponse>({
          success: true,
          message: 'Tick processed successfully',
          result,
        });
      } catch (error) {
        return this.successResponse<ApiSuccessResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Tick processing failed',
        });
      }
    });
  }

  @TsRestHandler(dmContract.hasActivePlayers)
  hasActivePlayers() {
    return tsRestHandler(dmContract.hasActivePlayers, async ({ query }) => {
      const minutes = query.minutesThreshold ?? 30;
      const hasActive = await this.playerService.hasActivePlayers(minutes);
      return {
        status: 200,
        body: {
          hasActivePlayers: hasActive,
        },
      };
    });
  }

  @TsRestHandler(dmContract.getGameState)
  getGameState() {
    return tsRestHandler(dmContract.getGameState, async () => {
      try {
        await this.gameTickService.getGameState();
        const monsters = await this.monsterService.getAllMonsters();
        const response: ApiGameStateResponse = {
          success: true,
          data: {
            currentTime: new Date().toISOString(),
            totalPlayers: 0,
            totalMonsters: monsters.length,
          },
        };

        return this.successResponse(response);
      } catch (error) {
        return this.successResponse<ApiGameStateResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to get game state',
        });
      }
    });
  }

  @TsRestHandler(dmContract.getMonstersAtLocation)
  getMonstersAtLocation() {
    return tsRestHandler(dmContract.getMonstersAtLocation, async ({ query }) => {
      const monsters = await this.monsterService.getMonstersAtLocation(
        query.x,
        query.y,
      );
      return {
        status: 200,
        body: this.serializeMonsters(monsters),
      };
    });
  }

  @TsRestHandler(dmContract.getAllMonsters)
  getAllMonsters() {
    return tsRestHandler(dmContract.getAllMonsters, async () => {
      const monsters = await this.monsterService.getAllMonsters();
      return {
        status: 200,
        body: this.serializeMonsters(monsters),
      };
    });
  }

  @TsRestHandler(dmContract.spawnMonster)
  spawnMonster() {
    return tsRestHandler(dmContract.spawnMonster, async ({ body }) => {
      try {
        const monster = await this.monsterService.spawnMonster(
          body.x,
          body.y,
          1,
        );
        return this.successResponse<ApiMonsterResponse>(
          {
            success: true,
            message: `Spawned ${monster.name} at (${body.x}, ${body.y})`,
            data: this.serializeMonsters([monster])[0],
          },
          201,
        );
      } catch (error) {
        return this.successResponse<ApiMonsterResponse>({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to spawn monster',
        });
      }
    });
  }
}
