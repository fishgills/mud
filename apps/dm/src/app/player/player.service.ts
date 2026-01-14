import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  getPrismaClient,
  findPlayerBySlackUser,
  Player,
  Prisma,
  touchWorkspaceActivity,
} from '@mud/database';
import {
  EventBus,
  type PlayerRespawnEvent,
  type PlayerActivityEvent,
} from '../../shared/event-bus';
import {
  CreatePlayerDto,
  PlayerStatsDto,
} from './dto/player.dto';
import { DiceRoll } from '@dice-roller/rpg-dice-roller';
import { PlayerItemService } from './player-item.service';
import { env } from '../../env';

interface GetPlayerOptions {
  requireCreationComplete?: boolean;
}

@Injectable()
export class PlayerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlayerService.name);
  private prisma = getPrismaClient();

  private readonly SKILL_POINT_INTERVAL = 4;
  private readonly SKILL_POINTS_PER_INTERVAL = 2;
  private readonly HIT_DIE_MAX = 10;
  private readonly HIT_DIE_AVERAGE = 6; // Average roll for a d10
  private activityUnsubscribe?: () => void;

  private readonly CREATION_INCOMPLETE_ERROR =
    'Finish character creation before performing this action. Use "reroll" to adjust stats or "complete" when you are ready.';

  constructor(
    private readonly playerItemService: PlayerItemService,
  ) {}

  onModuleInit(): void {
    this.activityUnsubscribe = EventBus.on('player:activity', (event) =>
      this.handlePlayerActivity(event as PlayerActivityEvent),
    );
  }

  onModuleDestroy(): void {
    if (this.activityUnsubscribe) {
      this.activityUnsubscribe();
      this.activityUnsubscribe = undefined;
    }
  }

  private ensureCreationComplete(player: Player): void {
    if (player.isCreationComplete === false) {
      throw new BadRequestException(this.CREATION_INCOMPLETE_ERROR);
    }
  }

  private async handlePlayerActivity(
    event: PlayerActivityEvent,
  ): Promise<void> {
    if (!event.playerId) {
      return;
    }

    try {
      const updates: Prisma.PlayerUpdateInput = {
        lastAction: new Date(),
        lastActiveAt: new Date(),
        hasStartedGame: true,
        totalCommandsExecuted: { increment: 1 },
      };
      if (event.source?.startsWith('combat:')) {
        updates.hasBattled = true;
      }
      await this.prisma.player.update({
        where: { id: event.playerId },
        data: updates,
      });
      if (event.teamId) {
        await touchWorkspaceActivity(event.teamId);
      }
    } catch (err) {
      const reason = event.source ?? 'unknown';
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to record activity for player ${event.playerId} (source=${reason}): ${message}`,
      );
    }
  }

  /**
   * Get top players by level and XP, optionally filtered by team/workspace
   */
  async getTopPlayers(limit = 10, teamId?: string) {
    const whereClause = teamId
      ? {
          slackUser: {
            teamId: teamId,
          },
        }
      : {};

    const players = await this.prisma.player.findMany({
      where: whereClause,
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      take: limit,
    });

    return players;
  }

  // Returns the cumulative XP threshold required to reach the next level.
  // Uses a triangular progression that grows with level:
  // T(level) = base * (level * (level + 1) / 2)
  // Examples (base=100): L1->2: 100, L2->3: 300, L3->4: 600, L4->5: 1000
  private getXpForNextLevel(level: number): number {
    const BASE = 100;
    return Math.floor((BASE * (level * (level + 1))) / 2);
  }

  private getStatModifier(stat: number): number {
    return Math.floor((stat - 10) / 2);
  }

  private calculateLevelUpHpGain(health: number): number {
    const modifier = this.getStatModifier(health);
    return Math.max(1, this.HIT_DIE_AVERAGE + modifier);
  }

  private calculatePerLevelHp(health: number): number {
    return this.calculateLevelUpHpGain(health);
  }

  private calculateMaxHpForLevel(level: number, health: number): number {
    if (level <= 0) return 0;
    const firstLevelHp = this.calculateFirstLevelHp(health);
    if (level === 1) return firstLevelHp;
    return firstLevelHp + (level - 1) * this.calculatePerLevelHp(health);
  }

  private applyMaxHpRecalculation(
    player: Player,
    options: { healthOverride?: number } = {},
  ): void {
    const health = options.healthOverride ?? player.health;
    const previousMax = player.maxHp;
    player.maxHp = this.calculateMaxHpForLevel(player.level, health);
    const delta = player.maxHp - previousMax;
    player.hp = Math.min(Math.max(0, player.hp + delta), player.maxHp);
  }

  private calculateFirstLevelHp(health: number): number {
    return Math.max(1, this.HIT_DIE_MAX + this.getStatModifier(health));
  }

  private async getEquipmentHealthBonus(playerId: number): Promise<number> {
    if (!this.playerItemService?.getEquipmentTotals) {
      return 0;
    }
    try {
      const totals = await this.playerItemService.getEquipmentTotals(playerId);
      return totals.vitalityBonus ?? 0;
    } catch (error) {
      this.logger.warn(
        `Failed to load equipment totals for player ${playerId}: ${error instanceof Error ? error.message : error}`,
      );
      return 0;
    }
  }

  async recalculatePlayerHitPointsFromEquipment(
    playerId: number,
  ): Promise<Player | null> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) return null;
    const equipmentBonus = await this.getEquipmentHealthBonus(playerId);
    this.applyMaxHpRecalculation(player, {
      healthOverride: player.health + equipmentBonus,
    });
    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        maxHp: player.maxHp,
        hp: player.hp,
      },
    });
    return player;
  }

  getMaxHpFor(health: number, level: number): number {
    return this.calculateMaxHpForLevel(level, health);
  }

  recalculatePlayerHitPoints(player: Player, healthOverride?: number): Player {
    this.applyMaxHpRecalculation(player, { healthOverride });
    return player;
  }

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const { teamId, userId, name } = createPlayerDto;

    // Validate that we have either userId or teamId
    if (!userId || !teamId) {
      throw new BadRequestException('Either userId or teamId must be provided');
    }

    // Check if player already exists (without throwing)
    let existing: Player | undefined;
    try {
      existing = await this.getPlayer(teamId, userId);
    } catch {
      existing = undefined;
    }

    if (existing) {
      throw new ConflictException('Player already exists');
    }

    const stats = this.generateRandomStats();

    const player = await this.prisma.player.create({
      data: {
        name,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        strength: stats.strength,
        agility: stats.agility,
        health: stats.health,
        level: 1,
        skillPoints: 0,
        gold: 0,
        xp: 0,
        isAlive: true,
      },
    });
    await this.prisma.slackUser.create({
      data: {
        teamId,
        userId,
        playerId: player.id,
      },
    });
    // PlayerFactory already emits player:spawn event, no need to emit again
    this.logger.log(
      `✅ Player created: ${player.name} for teamId=${teamId}, userId=${userId}`,
    );

    return player;
  }

  async getPlayer(
    teamId: string,
    userId: string,
    options?: GetPlayerOptions,
  ): Promise<Player> {
    this.logger.debug(
      `Looking up player for teamId=${teamId}, userId=${userId}`,
    );
    const player = await findPlayerBySlackUser({ userId, teamId });
    if (!player) {
      this.logger.warn(
        `Player not found for teamId=${teamId}, userId=${userId}`,
      );
      throw new NotFoundException('Player not found');
    }
    if (options?.requireCreationComplete) {
      this.ensureCreationComplete(player);
    }
    return player;
  }

  async getAllPlayers(): Promise<Player[]> {
    return this.prisma.player.findMany();
  }

  /**
   * Update the lastAction timestamp for a player (used for activity tracking)
   * @param teamId The team ID of the player
   */
  async updateLastAction(playerId: number): Promise<void> {
    await this.prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        lastAction: new Date(),
      },
    });
  }

  /**
   * Check if there are any players who have been active within the specified time window
   * @param minutesThreshold How many minutes back to check for activity (default: 30)
   * @returns true if any players have been active within the threshold
   */
  async hasActivePlayers(minutesThreshold: number = 30): Promise<boolean> {
    const count = await this.prisma.player.count({
      where: {
        lastAction: {
          gte: new Date(Date.now() - minutesThreshold * 60 * 1000),
        },
      },
    });

    return count > 0;
  }

  async getActivePlayers(
    minutesThreshold: number = env.ACTIVE_PLAYER_WINDOW_MINUTES,
  ): Promise<Player[]> {
    const windowMinutes = Math.max(0, minutesThreshold ?? 0);
    if (windowMinutes === 0) {
      return this.prisma.player.findMany({ where: { isAlive: true } });
    }

    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.prisma.player.findMany({
      where: {
        isAlive: true,
        lastAction: {
          gte: cutoff,
        },
      },
    });
  }

  async updatePlayerStats(
    teamId: string,
    userId: string,
    statsDto: PlayerStatsDto,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    const previousSkillPoints = player.skillPoints;
    const equipmentHealthBonus = await this.getEquipmentHealthBonus(player.id);
    const getEffectiveHealth = () => player.health + equipmentHealthBonus;

    // Handle character creation completion
    if (statsDto.completeCreation) {
      if (player.isCreationComplete) {
        throw new BadRequestException(
          'Character creation is already complete.',
        );
      }
      player.isCreationComplete = true;
      player.hasStartedGame = true;
      player.lastActiveAt = new Date();
    }

    if (typeof statsDto.hp === 'number') {
      player.hp = statsDto.hp;
    }

    if (typeof statsDto.gold === 'number') {
      player.gold = statsDto.gold;
    }

    if (typeof statsDto.level === 'number') {
      player.level = statsDto.level;
      this.applyMaxHpRecalculation(player, {
        healthOverride: getEffectiveHealth(),
      });
    }

    let leveledUp = false;
    let levelsGained = 0;

    if (typeof statsDto.xp === 'number') {
      player.xp = statsDto.xp;

      // Check for level-ups
      while (player.xp >= this.getXpForNextLevel(player.level)) {
        player.level += 1;
        levelsGained += 1;
        leveledUp = true;
        this.applyMaxHpRecalculation(player, {
          healthOverride: getEffectiveHealth(),
        });

        if (player.level % this.SKILL_POINT_INTERVAL === 0) {
          player.skillPoints += this.SKILL_POINTS_PER_INTERVAL;
        }
      }
    }

    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        xp: player.xp,
        level: player.level,
        maxHp: player.maxHp,
        hp: player.hp,
        skillPoints: player.skillPoints,
        isCreationComplete: player.isCreationComplete,
        gold: player.gold,
        agility: player.agility,
        strength: player.strength,
        hasStartedGame: player.hasStartedGame,
        lastActiveAt: player.lastActiveAt,
      },
    });

    if (leveledUp) {
      this.logger.log(
        `🎉 ${player.name} advanced ${levelsGained} level(s) to ${player.level}! Max HP is now ${player.maxHp}.`,
      );

      const dbPlayer = await this.prisma.player.findUnique({
        where: { id: player.id },
      });

      if (dbPlayer) {
        const skillPointsAwarded = Math.max(
          0,
          player.skillPoints - previousSkillPoints,
        );
        await EventBus.emit({
          eventType: 'player:levelup',
          player: dbPlayer,
          newLevel: player.level,
          skillPointsGained: skillPointsAwarded,
          timestamp: new Date(),
        });
      }
    }

    return player;
  }

  async spendSkillPoint(
    teamId: string,
    userId: string,
    attribute: 'strength' | 'agility' | 'health',
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    this.ensureCreationComplete(player);
    const equipmentHealthBonus = await this.getEquipmentHealthBonus(player.id);

    if (player.skillPoints <= 0) {
      throw new Error('No skill points available.');
    }

    if (player[attribute] >= 20) {
      throw new Error(`Cannot increase ${attribute} beyond 20.`);
    }

    player[attribute] += 1;
    player.skillPoints -= 1;

    if (attribute === 'health') {
      this.applyMaxHpRecalculation(player, {
        healthOverride: player.health + equipmentHealthBonus,
      });
    }

    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        strength: player.strength,
        agility: player.agility,
        health: player.health,
        maxHp: player.maxHp,
        skillPoints: player.skillPoints,
      },
    });

    const newAttributeValue = player[attribute];
    const remainingSkillPoints = player.skillPoints;

    this.logger.log(
      `⚔️ ${player.name} increased ${attribute} to ${newAttributeValue}. Remaining skill points: ${remainingSkillPoints}.`,
    );

    return player;
  }

  async rerollPlayerStats(teamId: string, userId: string): Promise<Player> {
    const currentPlayer = await this.getPlayer(teamId, userId);

    // Prevent rerolling if character creation is already complete
    if (currentPlayer.isCreationComplete) {
      throw new BadRequestException(
        'Character creation is complete. You cannot reroll anymore.',
      );
    }

    // Generate new random starting stats
    const { strength, agility, health } = this.generateRandomStats();
    const equipmentHealthBonus = await this.getEquipmentHealthBonus(
      currentPlayer.id,
    );

    // Update entity attributes
    currentPlayer.strength = strength;
    currentPlayer.agility = agility;
    currentPlayer.health = health;
    const effectiveHealth = health + equipmentHealthBonus;
    currentPlayer.maxHp = this.calculateMaxHpForLevel(
      currentPlayer.level,
      effectiveHealth,
    );
    currentPlayer.hp = currentPlayer.maxHp;

    await this.prisma.player.update({
      where: { id: currentPlayer.id },
      data: {
        strength,
        agility,
        health,
        maxHp: currentPlayer.maxHp,
        hp: currentPlayer.maxHp,
      },
    });

    return this.getPlayer(teamId, userId);
  }

  async healPlayer(
    teamId: string,
    userId: string,
    amount: number,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    player.hp = Math.min(player.hp + amount, player.maxHp);
    await this.prisma.player.update({
      where: { id: player.id },
      data: { hp: player.hp },
    });
    return player;
  }

  async damagePlayer(
    teamId: string,
    userId: string,
    damage: number,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    const wasAlive = player.isAlive;
    player.hp = player.hp - damage;
    if (player.hp <= 0) {
      player.hp = 0;
      player.isAlive = false;
    }

    await this.prisma.player.update({
      where: { id: player.id },
      data: { hp: player.hp, isAlive: player.isAlive },
    });

    // Emit player death event if they died from this damage
    if (wasAlive && !player.isAlive) {
      const dbPlayer = await this.prisma.player.findUnique({
        where: { id: player.id },
      });
      if (dbPlayer) {
        await EventBus.emit({
          eventType: 'player:death',
          player: dbPlayer,
          timestamp: new Date(),
        });
      }
      this.logger.log(`💀 Player ${player.name} has died`);
    }

    return player;
  }

  async restorePlayerHealth(teamId: string, userId: string): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    player.hp = player.maxHp;
    player.isAlive = true;
    await this.prisma.player.update({
      where: { id: player.id },
      data: { hp: player.hp, isAlive: true },
    });
    return player;
  }

  async respawnPlayer(teamId: string, userId: string): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    player.hp = player.maxHp;
    player.isAlive = true;
    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        hp: player.hp,
        isAlive: true,
      },
    });

    // Emit player respawn event
    const dbPlayer = await this.prisma.player.findUnique({
      where: { id: player.id },
      include: {
        slackUser: true,
      },
    });
    let respawnEvent: PlayerRespawnEvent | null = null;
    if (dbPlayer) {
      respawnEvent = {
        eventType: 'player:respawn',
        player: dbPlayer,
        timestamp: new Date(),
      };
      await EventBus.emit(respawnEvent);
    }
    this.logger.log(`🏥 Player ${player.name} respawned`);

    return player;
  }

  async deletePlayer(teamId: string, userId: string): Promise<Player> {
    const player = await this.prisma.slackUser.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      include: {
        player: true,
      },
    });
    return player.player;
  }

  /**
   * Generates random character stats and calculates maxHP
   * Used by both createPlayer and rerollPlayerStats to maintain consistency
   */
  private generateRandomStats(): {
    strength: number;
    agility: number;
    health: number;
    maxHp: number;
  } {
    const strength = new DiceRoll('4d6k3').total;
    const agility = new DiceRoll('4d6k3').total;
    const health = new DiceRoll('4d6k3').total;

    // Calculate starting HP using D&D first-level rule: max hit die + CON mod
    const maxHp = this.calculateFirstLevelHp(health);

    return { strength, agility, health, maxHp };
  }
}
