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
import {
  calculateEquipmentEffects,
  type EquippedPlayerItem,
  type EquipmentTotals,
} from '../../player/equipment.effects';
import { computePlayerCombatStats } from '../../player/player-stats.util';
import { PlayerService } from '../../player/player.service';
import { PlayerItemService } from '../../player/player-item.service';
import { CombatService } from '../../combat/combat.service';
import { AppError } from '../../errors/app-error';
import { RunsService } from '../../../modules/runs/runs.service';
import { EventBridgeService } from '../../../shared/event-bridge.service';
import { EventBus, type PlayerEquipmentEvent } from '../../../shared/event-bus';
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
import { AttackOrigin, TargetType } from '../dto/player-requests.dto';
import { getXpThresholdForLevel, getXpToNextLevel } from '@mud/constants';
import { formatWebRecipientId } from '@mud/redis-client';

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
    private readonly combatService: CombatService,
    private readonly playerItemService: PlayerItemService,
    private readonly runsService: RunsService,
    private readonly eventBridge: EventBridgeService,
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
        message: 'You have been resurrected!',
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
    const equipmentTotals = await this.playerItemService.getEquipmentTotals(
      player.id,
    );
    const combat = computePlayerCombatStats({
      ...player,
      equipmentTotals,
    });

    const xpForNextLevel = getXpThresholdForLevel(player.level);
    const prevThreshold =
      player.level > 1 ? getXpThresholdForLevel(player.level - 1) : 0;
    const xpProgress = Math.max(0, player.xp - prevThreshold);
    const xpNeeded = Math.max(0, xpForNextLevel - player.xp);

    const recentCombat = await this.combatService.getRecentCombatForPlayer(
      player.id,
    );

    return {
      player: player,
      combat,
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
    if (targetType !== TargetType.PLAYER) {
      return {
        success: false,
        message: 'PvE combat is only available through raids.',
      };
    }

    let attackOrigin = input.attackOrigin ?? AttackOrigin.TEXT_PVP;

    await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });
    const perf: AttackPerformanceStats = {
      totalMs: 0,
      preCombatMs: 0,
      combatMs: 0,
    };
    let targetResolutionMs: number | undefined;
    let errorMessage: string | undefined;

    try {
      let targetTeamId = input.targetTeamId;
      let targetUserId = input.targetUserId;
      const targetName = input.targetName?.trim();

      if (targetName) {
        const targetStart = Date.now();
        const targetPlayer =
          await this.playerService.findPlayerByName(targetName);
        targetResolutionMs = Date.now() - targetStart;

        if (!targetPlayer || !targetPlayer.slackUser) {
          throw new NotFoundException('No player found with that name.');
        }

        const targetSlack = targetPlayer.slackUser;
        if (targetSlack.teamId === teamId && targetSlack.userId === userId) {
          throw new BadRequestException("You can't attack yourself.");
        }

        targetTeamId = targetSlack.teamId;
        targetUserId = targetSlack.userId;
        if (targetTeamId !== teamId) {
          attackOrigin = AttackOrigin.GHOST_PVP;
        }
      }

      if (!targetUserId || typeof targetTeamId !== 'string') {
        throw new BadRequestException(
          'Must provide targetName or targetUserId for player attacks',
        );
      }

      perf.attackOrigin = attackOrigin;
      const combatStart = Date.now();
      perf.preCombatMs = combatStart - start;
      const result = (await this.combatService.playerAttackPlayer(
        {
          teamId,
          userId,
        },
        {
          teamId: targetTeamId,
          userId: targetUserId,
        },
        {
          attackOrigin,
        },
      )) as CombatResult;
      perf.combatMs = Date.now() - combatStart;
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
      perf.attackOrigin = attackOrigin;
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
        strengthBonus: 0,
        agilityBonus: 0,
        healthBonus: 0,
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
            value: item?.value ?? null,
            description: item?.description ?? null,
            itemType: item?.type ?? null,
            computedBonuses: {
              strengthBonus: applied.strengthBonus ?? 0,
              agilityBonus: applied.agilityBonus ?? 0,
              healthBonus: applied.healthBonus ?? 0,
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
          computedStats: computePlayerCombatStats({
            ...player,
            equipmentTotals,
          }),
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
      await this.runsService.ensurePlayerNotInRun(
        player.id,
        'Finish your raid before changing equipment.',
      );
      const updated = await this.playerItemService.equip(
        player.id,
        Number(playerItemId),
        slot as PlayerSlot,
      );
      await this.playerService.recalculatePlayerHitPointsFromEquipment(
        player.id,
      );
      if (payload.teamId && payload.userId) {
        const event: PlayerEquipmentEvent = {
          eventType: 'player:equipment',
          playerId: player.id,
          teamId: payload.teamId,
          userId: payload.userId,
          playerItemId: updated.id,
          action: 'equip',
          slot: updated.slot ?? slot ?? null,
          timestamp: new Date(),
        };
        void this.emitEquipmentEvent(event, null);
      }
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Equip failed',
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
      await this.runsService.ensurePlayerNotInRun(
        player.id,
        'Finish your raid before changing equipment.',
      );
      const updated = await this.playerItemService.unequip(
        player.id,
        Number(playerItemId),
      );
      await this.playerService.recalculatePlayerHitPointsFromEquipment(
        player.id,
      );
      if (payload.teamId && payload.userId) {
        const event: PlayerEquipmentEvent = {
          eventType: 'player:equipment',
          playerId: player.id,
          teamId: payload.teamId,
          userId: payload.userId,
          playerItemId: updated.id,
          action: 'unequip',
          slot: updated.slot ?? null,
          timestamp: new Date(),
        };
        void this.emitEquipmentEvent(event, null);
      }
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

  private async emitEquipmentEvent(
    event: PlayerEquipmentEvent,
    itemName: string | null,
  ): Promise<void> {
    try {
      await EventBus.emit(event);
      this.logger.debug(
        {
          eventType: event.eventType,
          playerId: event.playerId,
          playerItemId: event.playerItemId,
          action: event.action,
        },
        'player:equipment emitted',
      );
    } catch (error) {
      this.logger.warn({ error }, 'Failed to emit player:equipment event');
    }

    const message =
      event.action === 'equip'
        ? `Equipped ${itemName ?? 'item'}.`
        : `Unequipped ${itemName ?? 'item'}.`;

    try {
      await this.eventBridge.publishPlayerNotification(event, [
        {
          clientType: 'web',
          teamId: undefined,
          userId: formatWebRecipientId(event.teamId, event.userId),
          message,
          priority: 'normal',
        },
      ]);
      this.logger.debug(
        {
          eventType: event.eventType,
          teamId: event.teamId,
          userId: event.userId,
        },
        'player:equipment web notification published',
      );
    } catch (error) {
      this.logger.warn(
        { error },
        'Failed to publish web equipment notification',
      );
    }
  }
}
