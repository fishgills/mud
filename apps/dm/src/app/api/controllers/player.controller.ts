import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PlayerSlot, ItemType } from '@mud/database';
import type { PlayerItem, Item, Player } from '@mud/database';
import { Prisma } from '@mud/database';
import {
  calculateEquipmentEffects,
  type EquippedPlayerItem,
  type EquipmentTotals,
} from '../../player/equipment.effects';
import { PlayerService } from '../../player/player.service';
import { PlayerItemService } from '../../player/player-item.service';
import { MonsterService } from '../../monster/monster.service';
import { CombatService } from '../../combat/combat.service';
import { WorldService } from '../../world/world.service';
import { AppError } from '../../errors/app-error';
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
import { TargetType, AttackOrigin } from '../dto/player-requests.dto';
import { getXpThresholdForLevel, getXpToNextLevel } from '@mud/constants';

interface StatsUpdatePayload {
  teamId?: string;
  userId?: string;
  input: PlayerStatsRequest;
}

interface AttributePayload {
  teamId?: string;
  userId?: string;
  attribute: PlayerAttribute;
}

interface ValuePayload {
  teamId?: string;
  userId?: string;
  amount: number;
}

interface DamagePayload {
  teamId?: string;
  userId?: string;
  damage: number;
}

interface AttackPayload {
  teamId?: string;
  userId?: string;
  input: AttackRequest;
}

const PLAYER_NOT_FOUND_MESSAGE =
  'Player not found. DM the Slack bot with `new YourName` to create a character, then finish creation with `complete`.';

@Controller('players')
export class PlayersController {
  private readonly logger = new Logger(PlayersController.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly monsterService: MonsterService,
    private readonly combatService: CombatService,
    private readonly worldService: WorldService,
    private readonly playerItemService: PlayerItemService,
  ) {}

  @Post()
  async createPlayer(
    @Body() input: CreatePlayerRequest,
  ): Promise<PlayerResponse> {
    const teamId = input.teamId;
    const userId = input.userId;
    if (!userId || !teamId) {
      return {
        success: false,
        message: 'teamId and userId are required',
      };
    }

    const createDto = { ...input, teamId, userId };
    const entity = await this.playerService.createPlayer(createDto);
    const player = entity;
    return {
      success: true,
      data: player,
    };
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('limit') limit?: string,
    @Query('teamId') teamId?: string,
  ): Promise<{ success: boolean; data?: Player[] }> {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const entities = await this.playerService.getTopPlayers(limitNum, teamId);
      return {
        success: true,
        data: entities,
      };
    } catch (err) {
      this.logger.error('Failed to get leaderboard', err);
      return {
        success: false,
      };
    }
  }

  @Get()
  async getPlayer(
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
  ): Promise<PlayerResponse> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    if (!teamId) {
      throw new BadRequestException('teamId is required');
    }

    this.logger.log(
      ` Received getPlayer request for teamId: ${teamId}, userId: ${userId} `,
    );
    try {
      this.logger.log(
        `Calling playerService.getPlayer for teamId: ${teamId}, userId: ${userId}`,
      );
      const player = await this.playerService.getPlayer(teamId, userId);
      const equipmentTotals = await this.playerItemService.getEquipmentTotals(
        player.id,
      );
      const xpToNextLevel =
        typeof player.level === 'number' && typeof player.xp === 'number'
          ? getXpToNextLevel(player.level, player.xp)
          : undefined;

      return {
        success: true,
        data: { ...player, equipmentTotals, xpToNextLevel },
      };
    } catch (error) {
      this.logger.error(
        `Error getting player for teamId: ${teamId}, userId: ${userId}: ${error}`,
        error instanceof Error ? error.stack : error,
      );
      return {
        success: false,
        message:
          error instanceof NotFoundException
            ? PLAYER_NOT_FOUND_MESSAGE
            : error instanceof Error
              ? error.message
              : 'Player not found',
      };
    }
  }

  @Get('all')
  async getAllPlayers(): Promise<Player[]> {
    return this.playerService.getAllPlayers();
  }

  @Get('location')
  async getPlayersAtLocation(
    @Query('x') rawX: string,
    @Query('y') rawY: string,
  ): Promise<(Player & Prisma.SlackUserInclude)[]> {
    const x = Number.parseInt(rawX, 10);
    const y = Number.parseInt(rawY, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new BadRequestException('x and y query parameters must be numbers');
    }
    return this.playerService.getPlayersAtLocation(x, y);
  }

  @Post('stats')
  async updatePlayerStats(@Body() payload: StatsUpdatePayload) {
    if (!payload.teamId || !payload.userId) {
      throw new BadRequestException('teamId and userId are required');
    }
    try {
      const player = await this.playerService.updatePlayerStats(
        payload.teamId,
        payload.userId,
        payload.input,
      );
      return {
        success: true,
        data: player,
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
    if (!payload.teamId || !payload.userId) {
      throw new BadRequestException('teamId and userId are required');
    }

    if (!payload?.attribute) {
      throw new BadRequestException('attribute is required');
    }

    try {
      const player = await this.playerService.spendSkillPoint(
        payload.teamId,
        payload.userId,
        payload.attribute,
      );
      return {
        success: true,
        data: player,
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
    @Body() payload: { teamId?: string; userId?: string },
  ): Promise<PlayerResponse> {
    if (!payload.teamId || !payload.userId) {
      throw new BadRequestException('teamId and userId are required');
    }

    try {
      const player = await this.playerService.rerollPlayerStats(
        payload.teamId,
        payload.userId,
      );
      return {
        success: true,
        data: player,
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
    if (!payload.teamId || !payload.userId) {
      throw new BadRequestException('teamId and userId are required');
    }

    if (typeof payload.amount !== 'number') {
      throw new BadRequestException('amount must be a number');
    }
    try {
      const player = await this.playerService.healPlayer(
        payload.teamId,
        payload.userId,
        payload.amount,
      );
      return {
        success: true,
        data: player,
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
    if (!payload.teamId || !payload.userId) {
      throw new BadRequestException('teamId and userId are required');
    }

    if (typeof payload.damage !== 'number') {
      throw new BadRequestException('damage must be a number');
    }
    try {
      const player = await this.playerService.damagePlayer(
        payload.teamId,
        payload.userId,
        payload.damage,
      );
      return {
        success: true,
        data: player,
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
  async respawn(
    @Body() payload: { teamId?: string; userId?: string },
  ): Promise<PlayerResponse> {
    if (!payload.teamId || !payload.userId) {
      throw new BadRequestException('teamId and userId are required');
    }
    try {
      const player = await this.playerService.respawnPlayer(
        payload.teamId,
        payload.userId,
      );
      return {
        success: true,
        data: player,
        message: 'You have been resurrected at the starting location!',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Respawn failed',
      };
    }
  }

  @Delete(':teamId/:userId')
  async deletePlayer(
    @Param('userId') userId: string,
    @Param('teamId') teamId: string,
  ): Promise<PlayerResponse> {
    if (!teamId || !userId) {
      throw new BadRequestException('teamId and userId are required');
    }
    try {
      const player = await this.playerService.deletePlayer(teamId, userId);
      return {
        success: true,
        data: player,
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
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ): Promise<PlayerStats> {
    const player = await this.playerService.getPlayer(teamId, userId);

    const strengthModifier = Math.floor((player.strength - 10) / 2);
    const agilityModifier = Math.floor((player.agility - 10) / 2);
    const healthModifier = Math.floor((player.health - 10) / 2);

    const dodgeChance = Math.max(0, (player.agility - 10) * 5);
    const baseDamage = `1d6${strengthModifier >= 0 ? '+' : ''}${strengthModifier}`;
    const armorClass = 10 + agilityModifier;

    const xpForNextLevel = getXpThresholdForLevel(player.level);
    const prevThreshold =
      player.level > 1 ? getXpThresholdForLevel(player.level - 1) : 0;
    const xpProgress = Math.max(0, player.xp - prevThreshold);
    const xpNeeded = Math.max(0, xpForNextLevel - player.xp);

    const recentCombat = await this.combatService.getCombatLogForLocation(
      player.x,
      player.y,
    );

    return {
      player: player,
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
    const { teamId, userId, input } = payload ?? {};

    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    if (!teamId) {
      throw new BadRequestException('teamId is required');
    }
    if (!input) {
      throw new BadRequestException('input is required');
    }

    const targetType = input.targetType;
    const ignoreLocationFlag = input.ignoreLocation === true;
    const attackOrigin =
      input.attackOrigin ??
      (targetType === TargetType.MONSTER
        ? AttackOrigin.TEXT_PVE
        : AttackOrigin.TEXT_PVP);

    await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });
    const perf: AttackPerformanceStats = {
      totalMs: 0,
      preCombatMs: 0,
      combatMs: 0,
    };
    perf.attackOrigin = attackOrigin;
    let targetResolutionMs: number | undefined;

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
          {
            teamId,
            userId,
          },
          input.targetId,
          { attackOrigin },
        )) as CombatResult;
        perf.combatMs = Date.now() - combatStart;
      } else if (targetType === TargetType.PLAYER) {
        if (!input.targetUserId && typeof input.targetTeamId !== 'string') {
          throw new BadRequestException(
            'Must provide targetUserId or targetId for player attacks',
          );
        }

        const combatStart = Date.now();
        perf.preCombatMs = combatStart - start;
        result = (await this.combatService.playerAttackPlayer(
          {
            teamId,
            userId,
          },
          {
            teamId: input.targetTeamId!,
            userId: input.targetUserId!,
          },
          ignoreLocationFlag,
          {
            attackOrigin,
          },
        )) as CombatResult;
        perf.combatMs = Date.now() - combatStart;
      } else {
        throw new BadRequestException('Invalid target type');
      }

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
    }
  }

  @Get('items')
  async getPlayerItems(
    @Query('teamId') teamId: string,
    @Query('userId') userId: string,
  ) {
    try {
      const player = await this.playerService.getPlayer(teamId, userId);
      const equipmentTotals = await this.playerItemService.getEquipmentTotals(
        player.id,
      );

      // Fetch bag items
      const bagItems = await this.playerItemService.listBag(player.id);
      const bagEffects = calculateEquipmentEffects(
        bagItems as EquippedPlayerItem[],
      );
      const perItemBonuses = bagEffects.details.reduce((acc, detail) => {
        acc.set(detail.playerItemId, detail.applied);
        return acc;
      }, new Map<number, EquipmentTotals>());
      const emptyBonuses: EquipmentTotals = {
        attackBonus: 0,
        damageBonus: 0,
        armorBonus: 0,
        vitalityBonus: 0,
        weaponDamageRoll: null,
      };

      const bag = (bagItems || []).map(
        (pi: PlayerItem & { item?: Item | null }) => {
          const item = pi.item ?? null;
          const allowedSlots: string[] = [];
          const rawItemType = item?.type;
          if (item && item.slot) {
            // item.slot is a PlayerSlot enum value
            allowedSlots.push(String(item.slot));
          } else if (
            typeof rawItemType === 'string' &&
            rawItemType.toUpperCase() === ItemType.WEAPON
          ) {
            // fallback: weapons equip to weapon slot
            allowedSlots.push(PlayerSlot.weapon);
          }

          const applied = { ...(perItemBonuses.get(pi.id) ?? emptyBonuses) };

          return {
            id: pi.id,
            playerId: pi.playerId,
            itemId: pi.itemId,
            // Expose the human-friendly item name so UIs can render it
            itemName: item?.name ?? null,
            quality: String(pi.quality ?? 'Common'),
            equipped: Boolean(pi.equipped ?? false),
            slot: pi.slot ?? null,
            allowedSlots,
            damageRoll: item?.damageRoll ?? null,
            defense: item?.defense ?? null,
            healthBonus: item?.healthBonus ?? null,
            value: item?.value ?? null,
            description: item?.description ?? null,
            itemType: item?.type ?? null,
            computedBonuses: {
              attackBonus: applied.attackBonus ?? 0,
              damageBonus: applied.damageBonus ?? 0,
              armorBonus: applied.armorBonus ?? 0,
              vitalityBonus: applied.vitalityBonus ?? 0,
              weaponDamageRoll: applied.weaponDamageRoll ?? null,
            },
            createdAt:
              pi.createdAt instanceof Date
                ? pi.createdAt.toISOString()
                : new Date().toISOString(),
          };
        },
      );

      return {
        success: true,
        data: {
          ...player,
          equipmentTotals,
          bag,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to fetch items',
        code: error instanceof AppError ? error.code : undefined,
      };
    }
  }

  @Post('pickup')
  async pickup(
    @Body()
    payload: {
      teamId: string;
      userId: string;
      worldItemId?: number;
    },
  ) {
    const { worldItemId } = payload ?? {};
    if (
      !worldItemId ||
      (typeof worldItemId !== 'number' && isNaN(Number(worldItemId)))
    ) {
      return { success: false, message: 'worldItemId is required' };
    }

    try {
      const player = await this.resolvePlayerFromPayload(payload);
      const created = await this.playerItemService.pickup(
        player.id,
        Number(worldItemId),
      );
      return { success: true, data: created };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Pickup failed',
        code: error instanceof AppError ? error.code : undefined,
      };
    }
  }

  @Post('equip')
  async equip(
    @Body()
    payload: {
      teamId: string;
      userId: string;
      playerItemId?: number;
      slot?: string;
    },
  ) {
    const { playerItemId, slot } = payload ?? {};
    if (!playerItemId || !slot) {
      return { success: false, message: 'playerItemId and slot are required' };
    }
    // Validate slot against allowed player slots
    if (
      typeof slot !== 'string' ||
      !Object.values(PlayerSlot).includes(slot as PlayerSlot)
    ) {
      return { success: false, message: 'Invalid slot' };
    }
    try {
      const player = await this.resolvePlayerFromPayload(payload);
      const updated = await this.playerItemService.equip(
        player.id,
        Number(playerItemId),
        slot as PlayerSlot,
      );
      await this.playerService.recalculatePlayerHitPointsFromEquipment(
        player.id,
      );
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Equip failed',
        code: error instanceof AppError ? error.code : undefined,
      };
    }
  }

  @Post('drop')
  async drop(
    @Body()
    payload: {
      teamId: string;
      userId: string;
      playerItemId?: number;
    },
  ) {
    const { playerItemId } = payload ?? {};
    if (!playerItemId) {
      return { success: false, message: 'playerItemId is required' };
    }
    try {
      const player = await this.resolvePlayerFromPayload(payload);
      const created = await this.playerItemService.drop(
        player.id,
        Number(playerItemId),
      );
      await this.playerService.recalculatePlayerHitPointsFromEquipment(
        player.id,
      );
      return { success: true, data: created };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Drop failed',
        code: error instanceof AppError ? error.code : undefined,
      };
    }
  }

  @Post('unequip')
  async unequip(
    @Body()
    payload: {
      teamId: string;
      userId: string;
      playerItemId?: number;
    },
  ) {
    const { playerItemId } = payload ?? {};
    if (!playerItemId) {
      return { success: false, message: 'playerItemId is required' };
    }
    try {
      const player = await this.resolvePlayerFromPayload(payload);
      const updated = await this.playerItemService.unequip(
        player.id,
        Number(playerItemId),
      );
      await this.playerService.recalculatePlayerHitPointsFromEquipment(
        player.id,
      );
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unequip failed',
        code: error instanceof AppError ? error.code : undefined,
      };
    }
  }

  private async resolvePlayerFromPayload(payload: {
    teamId: string;
    userId: string;
  }) {
    return this.playerService.getPlayer(payload.teamId, payload.userId);
  }
}
