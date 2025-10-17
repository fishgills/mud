import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { PlayerEntity } from '@mud/engine';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { CombatService } from '../../combat/combat.service';
import { WorldService } from '../../world/world.service';
import { EntityToDtoAdapter } from '../adapters/entity-to-dto.adapter';
import type { Player } from '../dto/player.dto';
import type { Monster } from '../dto/monster.dto';
import type { CombatLog } from '../dto/combat-log.dto';
import type {
  PlayerResponse,
  CombatResponse,
  PlayerStats,
  CombatResult,
  AttackPerformanceStats,
} from '../dto/responses.dto';
import type {
  AttackRequest,
  CreatePlayerRequest,
  PlayerAttribute,
  PlayerStatsRequest,
} from '../dto/player-requests.dto';
import { TargetType } from '../dto/player-requests.dto';

interface StatsUpdatePayload {
  slackId: string;
  input: PlayerStatsRequest;
}

interface AttributePayload {
  slackId: string;
  attribute: PlayerAttribute;
}

interface ValuePayload {
  slackId: string;
  amount: number;
}

interface DamagePayload {
  slackId: string;
  damage: number;
}

interface AttackPayload {
  slackId: string;
  input: AttackRequest;
}

@Controller('players')
export class PlayersController {
  private readonly logger = new Logger(PlayersController.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly monsterService: MonsterService,
    private readonly combatService: CombatService,
    private readonly worldService: WorldService,
  ) {}

  @Post()
  async createPlayer(
    @Body() input: CreatePlayerRequest,
  ): Promise<PlayerResponse> {
    if (!input?.clientId && !input?.slackId) {
      return {
        success: false,
        message: 'Either clientId/clientType or slackId must be provided',
      };
    }

    const entity = await this.playerService.createPlayer(input);
    const player = await this.buildPlayerDto(entity, { includeDetails: false });
    return {
      success: true,
      data: player,
    };
  }

  @Get()
  async getPlayer(
    @Query('slackId') slackId?: string,
    @Query('clientId') clientId?: string,
    @Query('name') name?: string,
  ): Promise<PlayerResponse> {
    if (!slackId && !clientId && !name) {
      return {
        success: false,
        message: 'A clientId, slackId, or player name must be provided',
      };
    }

    const identifier = clientId
      ? `clientId: ${clientId}`
      : slackId
        ? `slackId: ${slackId}`
        : `name: ${name ?? 'unknown'}`;
    this.logger.log(`[DM-AUTH] Received getPlayer request for ${identifier}`);
    try {
      this.logger.log(
        `[DM-AUTH] Calling playerService.getPlayer for ${identifier}`,
      );
      const entity = await this.playerService.getPlayerByIdentifier({
        slackId,
        clientId,
        name,
      });
      const player = await this.buildPlayerDto(entity, {
        includeDetails: true,
        includeNearby: true,
      });
      this.logger.log(
        `[DM-AUTH] Successfully retrieved player for ${identifier}, player ID: ${player.id}`,
      );
      return {
        success: true,
        data: player,
      };
    } catch (error) {
      this.logger.error(
        `[DM-AUTH] Error getting player for ${identifier}`,
        error instanceof Error ? error.stack : error,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Player not found',
      };
    }
  }

  @Get('all')
  async getAllPlayers(): Promise<Player[]> {
    const players = await this.playerService.getAllPlayers();
    return EntityToDtoAdapter.playerEntitiesToDto(players);
  }

  @Get('location')
  async getPlayersAtLocation(
    @Query('x') rawX: string,
    @Query('y') rawY: string,
  ): Promise<Player[]> {
    const x = Number.parseInt(rawX, 10);
    const y = Number.parseInt(rawY, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new BadRequestException('x and y query parameters must be numbers');
    }
    const players = await this.playerService.getPlayersAtLocation(x, y);
    return EntityToDtoAdapter.playerEntitiesToDto(players);
  }

  @Post('stats')
  async updatePlayerStats(
    @Body() payload: StatsUpdatePayload,
  ): Promise<PlayerResponse> {
    if (!payload?.slackId) {
      throw new BadRequestException('slackId is required');
    }
    try {
      const player = await this.playerService.updatePlayerStats(
        payload.slackId,
        payload.input ?? {},
      );
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update player stats',
      };
    }
  }

  @Post('spend-skill-point')
  async spendSkillPoint(
    @Body() payload: AttributePayload,
  ): Promise<PlayerResponse> {
    if (!payload?.slackId) {
      throw new BadRequestException('slackId is required');
    }
    if (!payload?.attribute) {
      throw new BadRequestException('attribute is required');
    }

    try {
      const player = await this.playerService.spendSkillPoint(
        payload.slackId,
        payload.attribute,
      );
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to spend skill point',
      };
    }
  }

  @Post('reroll')
  async rerollPlayerStats(
    @Body() payload: { slackId: string },
  ): Promise<PlayerResponse> {
    if (!payload?.slackId) {
      throw new BadRequestException('slackId is required');
    }
    try {
      const player = await this.playerService.rerollPlayerStats(
        payload.slackId,
      );
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reroll player stats',
      };
    }
  }

  @Post('heal')
  async healPlayer(@Body() payload: ValuePayload): Promise<PlayerResponse> {
    if (!payload?.slackId) {
      throw new BadRequestException('slackId is required');
    }
    if (typeof payload.amount !== 'number') {
      throw new BadRequestException('amount must be a number');
    }
    try {
      const player = await this.playerService.healPlayer(
        payload.slackId,
        payload.amount,
      );
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to heal player',
      };
    }
  }

  @Post('damage')
  async damagePlayer(@Body() payload: DamagePayload): Promise<PlayerResponse> {
    if (!payload?.slackId) {
      throw new BadRequestException('slackId is required');
    }
    if (typeof payload.damage !== 'number') {
      throw new BadRequestException('damage must be a number');
    }
    try {
      const player = await this.playerService.damagePlayer(
        payload.slackId,
        payload.damage,
      );
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to damage player',
      };
    }
  }

  @Post('respawn')
  async respawn(@Body() payload: { slackId: string }): Promise<PlayerResponse> {
    if (!payload?.slackId) {
      throw new BadRequestException('slackId is required');
    }
    try {
      const player = await this.playerService.respawnPlayer(payload.slackId);
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
        message: 'You have been resurrected at the starting location!',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Respawn failed',
      };
    }
  }

  @Delete(':slackId')
  async deletePlayer(
    @Param('slackId') slackId: string,
  ): Promise<PlayerResponse> {
    if (!slackId) {
      throw new BadRequestException('slackId is required');
    }
    try {
      const player = await this.playerService.deletePlayer(slackId);
      return {
        success: true,
        data: await this.buildPlayerDto(player, { includeDetails: false }),
        message: 'Player deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete character',
      };
    }
  }

  @Get('stats')
  async getPlayerStats(
    @Query('slackId') slackId?: string,
    @Query('name') name?: string,
  ): Promise<PlayerStats> {
    const player = await this.playerService.getPlayerByIdentifier({
      slackId,
      name,
    });

    const strengthModifier = Math.floor((player.attributes.strength - 10) / 2);
    const agilityModifier = Math.floor((player.attributes.agility - 10) / 2);
    const healthModifier = Math.floor((player.attributes.health - 10) / 2);

    const dodgeChance = Math.max(0, (player.attributes.agility - 10) * 5);
    const baseDamage = `1d6${strengthModifier >= 0 ? '+' : ''}${strengthModifier}`;
    const armorClass = 10 + agilityModifier;

    const xpThreshold = (lvl: number) =>
      Math.floor((100 * (lvl * (lvl + 1))) / 2);
    const xpForNextLevel = xpThreshold(player.level);
    const prevThreshold = player.level > 1 ? xpThreshold(player.level - 1) : 0;
    const xpProgress = Math.max(0, player.xp - prevThreshold);
    const xpNeeded = Math.max(0, xpForNextLevel - player.xp);

    const recentCombat = await this.combatService.getCombatLogForLocation(
      player.position.x,
      player.position.y,
    );

    return {
      player: await this.buildPlayerDto(player, { includeDetails: false }),
      strengthModifier,
      agilityModifier,
      healthModifier,
      dodgeChance,
      baseDamage,
      armorClass,
      xpForNextLevel,
      xpProgress,
      xpNeeded,
      recentCombat: recentCombat as CombatLog[],
    };
  }

  @Post('attack')
  async attack(@Body() payload: AttackPayload): Promise<CombatResponse> {
    const start = Date.now();
    const { slackId, input } = payload ?? {};
    if (!slackId) {
      throw new BadRequestException('slackId is required');
    }
    if (!input) {
      throw new BadRequestException('input is required');
    }

    const targetType = input.targetType;
    const ignoreLocationFlag = input.ignoreLocation === true;
    const perf: AttackPerformanceStats = {
      totalMs: 0,
      preCombatMs: 0,
      combatMs: 0,
    };
    let targetResolutionMs: number | undefined;
    let targetSlackId = input.targetSlackId ?? undefined;
    const targetId =
      typeof input.targetId === 'number' ? input.targetId : undefined;
    let success = false;
    let errorMessage: string | undefined;

    try {
      let result: CombatResult | undefined;

      if (targetType === TargetType.MONSTER) {
        if (typeof input.targetId !== 'number') {
          throw new BadRequestException(
            'targetId is required for monster attacks',
          );
        }
        const combatStart = Date.now();
        perf.preCombatMs = combatStart - start;
        result = (await this.combatService.playerAttackMonster(
          slackId,
          input.targetId,
        )) as CombatResult;
        perf.combatMs = Date.now() - combatStart;
      } else if (targetType === TargetType.PLAYER) {
        let resolvedSlackId = targetSlackId;
        if (!resolvedSlackId) {
          if (typeof input.targetId === 'number') {
            const resolutionStart = Date.now();
            const allPlayers = await this.playerService.getAllPlayers();
            targetResolutionMs = Date.now() - resolutionStart;
            const targetPlayer = allPlayers.find(
              (p) => p.id === input.targetId,
            );
            if (!targetPlayer) {
              throw new BadRequestException('Target player not found');
            }
            resolvedSlackId = targetPlayer.clientId || undefined;
          } else {
            throw new BadRequestException(
              'Must provide targetSlackId or targetId for player attacks',
            );
          }
        }

        targetSlackId = resolvedSlackId;
        if (!targetSlackId) {
          throw new BadRequestException(
            'Target player has no valid identifier',
          );
        }

        const combatStart = Date.now();
        perf.preCombatMs = combatStart - start;
        result = (await this.combatService.playerAttackPlayer(
          slackId,
          targetSlackId,
          ignoreLocationFlag,
        )) as CombatResult;
        perf.combatMs = Date.now() - combatStart;
      } else {
        throw new BadRequestException('Invalid target type');
      }

      success = true;
      perf.totalMs = Date.now() - start;
      if (typeof targetResolutionMs === 'number') {
        perf.targetResolutionMs = targetResolutionMs;
      }
      if (result?.perfBreakdown) {
        perf.combatBreakdown = result.perfBreakdown;
      }
      return {
        success: true,
        data: result,
        perf,
      };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Attack failed';
      if (perf.preCombatMs === 0) {
        perf.preCombatMs = Date.now() - start;
      }
      perf.totalMs = Date.now() - start;
      if (typeof targetResolutionMs === 'number') {
        perf.targetResolutionMs = targetResolutionMs;
      }
      return {
        success: false,
        message: errorMessage,
        perf,
      };
    } finally {
      perf.totalMs = Date.now() - start;
      if (typeof targetResolutionMs === 'number') {
        perf.targetResolutionMs = targetResolutionMs;
      }
      if (slackId) {
        try {
          const logPayload = {
            event: 'players.attack.perf',
            slackId,
            targetType,
            targetSlackId,
            targetId,
            ignoreLocation: ignoreLocationFlag,
            success,
            totalMs: perf.totalMs,
            preCombatMs: perf.preCombatMs,
            combatMs: perf.combatMs,
            targetResolutionMs: perf.targetResolutionMs,
            error: success ? undefined : errorMessage,
          };
          this.logger.log(JSON.stringify(logPayload));
        } catch (loggingError) {
          this.logger.debug(
            `Failed to emit attack perf log: ${loggingError instanceof Error ? loggingError.message : String(loggingError)}`,
          );
        }
      }
    }
  }

  private async buildPlayerDto(
    entity: PlayerEntity | Player,
    options: { includeDetails?: boolean; includeNearby?: boolean } = {},
  ): Promise<Player> {
    const { includeDetails = true, includeNearby = false } = options;
    const base = EntityToDtoAdapter.playerEntityToDto(entity);

    if (!includeDetails && !includeNearby) {
      return base;
    }

    const [currentTile, nearbyMonsters, nearbyPlayers] = await Promise.all([
      includeDetails
        ? this.worldService
            .getTileInfo(base.x, base.y)
            .then((tile) => ({
              x: tile.x,
              y: tile.y,
              biomeName: tile.biomeName,
              description: tile.description ?? undefined,
              height: tile.height,
              temperature: tile.temperature,
              moisture: tile.moisture,
            }))
            .catch(() => undefined)
        : Promise.resolve(undefined),
      includeNearby
        ? this.monsterService
            .getMonstersAtLocation(base.x, base.y)
            .then((monsters) =>
              EntityToDtoAdapter.monsterEntitiesToDto(monsters ?? []),
            )
        : Promise.resolve<Monster[] | undefined>(undefined),
      includeNearby
        ? this.loadNearbyPlayers(base).catch(() => [])
        : Promise.resolve<Player[] | undefined>(undefined),
    ]);

    return {
      ...base,
      currentTile,
      nearbyMonsters: nearbyMonsters ?? base.nearbyMonsters,
      nearbyPlayers: nearbyPlayers ?? base.nearbyPlayers,
    };
  }

  private async loadNearbyPlayers(center: Player): Promise<Player[]> {
    const results: Player[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const playersAtLocation = await this.playerService.getPlayersAtLocation(
          center.x + dx,
          center.y + dy,
          { excludePlayerId: center.id },
        );
        results.push(
          ...EntityToDtoAdapter.playerEntitiesToDto(playersAtLocation ?? []),
        );
      }
    }
    return results;
  }
}
