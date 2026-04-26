import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AchievementConditionType,
  AchievementScope,
  Prisma,
  RunStatus,
  getPrismaClient,
  touchWorkspaceActivity,
  type AchievementDefinition,
  type PlayerAchievementStats,
  type WorkspaceBroadcastConfig,
} from '@mud/database';
import { PlayerService } from '../../app/player/player.service';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { buildBattleforgeRecipients } from '../../shared/battleforge-channel.recipients';
import {
  PLAYER_ACHIEVEMENT_DEFINITIONS,
  type AchievementDefinitionSeed,
} from './achievements.definitions';

export type PerPlayerRunStats = {
  damageDealt: number;
  damageTaken: number;
  kills: number;
  crits: number;
  biggestHit: number;
  minHpAfter?: number;
};

export type RunEndParticipant = {
  playerId: number;
  playerName: string;
  teamId: string;
  userId: string;
};

export type RecordRunEndedInput = {
  runId: number;
  runStatus: RunStatus;
  depthReached: number;
  bankedGold: number;
  participants: RunEndParticipant[];
  perPlayerStats: Map<number, PerPlayerRunStats>;
};

type AchievementEvaluationContext =
  | {
      source: 'run';
      runStatus: RunStatus;
      depthReached: number;
      continuesCount: number;
      bankedGold: number;
      damageTakenThisRun: number;
      biggestHitThisRun: number;
      closeCall: boolean;
      greedyLoss: boolean;
    }
  | {
      source: 'shop' | 'equip';
    };

type UnlockedAchievement = {
  id: string;
  name: string;
  description: string;
  broadcastOnUnlock: boolean;
  broadcastTemplate: string | null;
};

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);
  private readonly prisma = getPrismaClient();

  constructor(
    private readonly playerService: PlayerService,
    private readonly eventBridge: EventBridgeService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefinitions();
  }

  async recordRunStarted(teamId: string, userId: string): Promise<void> {
    try {
      const player = await this.playerService.getPlayer(teamId, userId, {
        requireCreationComplete: true,
      });
      await this.ensurePlayerStatsRow(player.id);
      await this.prisma.playerAchievementStats.update({
        where: { playerId: player.id },
        data: {
          totalRaidsStarted: { increment: 1 },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record raid start achievements for ${teamId}:${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async recordRunEnded(input: RecordRunEndedInput): Promise<void> {
    for (const participant of input.participants) {
      try {
        const runStats = input.perPlayerStats.get(participant.playerId) ?? {
          damageDealt: 0,
          damageTaken: 0,
          kills: 0,
          crits: 0,
          biggestHit: 0,
        };
        const won = input.runStatus === RunStatus.CASHED_OUT;
        const continuesCount = Math.max(0, input.depthReached - 1);

        const current = await this.ensurePlayerStatsRow(participant.playerId);
        const nextCurrentStreak = won ? current.currentWinStreak + 1 : 0;
        const nextBestStreak = won
          ? Math.max(current.bestWinStreak, nextCurrentStreak)
          : current.bestWinStreak;

        const updateData: Prisma.PlayerAchievementStatsUpdateInput = {
          currentWinStreak: nextCurrentStreak,
          bestWinStreak: nextBestStreak,
          maxRaidDepthReached: Math.max(
            current.maxRaidDepthReached,
            input.depthReached,
          ),
          maxRaidDepthFinished: Math.max(
            current.maxRaidDepthFinished,
            won ? input.depthReached : 0,
          ),
          biggestHit: Math.max(current.biggestHit, runStats.biggestHit),
        };

        this.setIncrement(updateData, 'totalRaidsFinished', won ? 1 : 0);
        this.setIncrement(updateData, 'totalRaidWins', won ? 1 : 0);
        this.setIncrement(updateData, 'totalRaidLosses', won ? 0 : 1);
        this.setIncrement(updateData, 'totalDamageDealt', runStats.damageDealt);
        this.setIncrement(updateData, 'totalDamageTaken', runStats.damageTaken);
        this.setIncrement(updateData, 'totalKills', runStats.kills);
        this.setIncrement(updateData, 'totalCrits', runStats.crits);
        this.setIncrement(
          updateData,
          'totalGoldEarned',
          won ? input.bankedGold : 0,
        );

        const updated = await this.prisma.playerAchievementStats.update({
          where: { playerId: participant.playerId },
          data: updateData,
        });

        const unlocked = await this.evaluateAndUnlockPlayerAchievements({
          playerId: participant.playerId,
          stats: updated,
          context: {
            source: 'run',
            runStatus: input.runStatus,
            depthReached: input.depthReached,
            continuesCount,
            bankedGold: input.bankedGold,
            damageTakenThisRun: runStats.damageTaken,
            biggestHitThisRun: runStats.biggestHit,
            closeCall: runStats.minHpAfter === 1,
            greedyLoss: !won && continuesCount >= 4,
          },
        });

        if (unlocked.length > 0) {
          await this.sendUnlockDm(
            participant.teamId,
            participant.userId,
            participant.playerId,
            unlocked,
          );
          await this.maybeBroadcastUnlocks(
            participant.teamId,
            participant.playerId,
            participant.playerName,
            unlocked,
          );
          await this.postUnlocksToBattleforge(
            participant.playerId,
            participant.playerName,
            unlocked,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to record raid end achievements for player ${participant.playerId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async recordShopPurchase(input: {
    teamId: string;
    userId: string;
    playerId: number;
    goldSpent: number;
    quantity: number;
    legendaryPurchased: number;
    itemName?: string;
  }): Promise<void> {
    try {
      const current = await this.ensurePlayerStatsRow(input.playerId);
      const updateData: Prisma.PlayerAchievementStatsUpdateInput = {};
      this.setIncrement(updateData, 'totalGoldSpent', input.goldSpent);
      this.setIncrement(updateData, 'totalItemsPurchased', input.quantity);
      this.setIncrement(
        updateData,
        'totalLegendaryItemsPurchased',
        input.legendaryPurchased,
      );

      const updated = await this.prisma.playerAchievementStats.update({
        where: { playerId: current.playerId },
        data: updateData,
      });

      const unlocked = await this.evaluateAndUnlockPlayerAchievements({
        playerId: input.playerId,
        stats: updated,
        context: { source: 'shop' },
      });

      if (unlocked.length > 0) {
        await this.sendUnlockDm(
          input.teamId,
          input.userId,
          input.playerId,
          unlocked,
        );
        const player = await this.playerService.getPlayer(
          input.teamId,
          input.userId,
        );
        await this.maybeBroadcastUnlocks(
          input.teamId,
          input.playerId,
          player.name,
          unlocked,
        );
        await this.postUnlocksToBattleforge(
          input.playerId,
          player.name,
          unlocked,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to record shop purchase achievements for ${input.teamId}:${input.userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async recordShopSell(input: {
    playerId: number;
    goldEarned: number;
  }): Promise<void> {
    try {
      await this.ensurePlayerStatsRow(input.playerId);
      await this.prisma.playerAchievementStats.update({
        where: { playerId: input.playerId },
        data: {
          totalGoldEarned: { increment: Math.max(0, input.goldEarned) },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record shop sell achievements for player ${input.playerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async recordItemEquipped(teamId: string, userId: string): Promise<void> {
    try {
      const player = await this.playerService.getPlayer(teamId, userId, {
        requireCreationComplete: true,
      });
      await this.ensurePlayerStatsRow(player.id);
      const updated = await this.prisma.playerAchievementStats.update({
        where: { playerId: player.id },
        data: {
          totalItemsEquipped: { increment: 1 },
        },
      });

      const unlocked = await this.evaluateAndUnlockPlayerAchievements({
        playerId: player.id,
        stats: updated,
        context: { source: 'equip' },
      });

      if (unlocked.length > 0) {
        await this.sendUnlockDm(teamId, userId, player.id, unlocked);
        await this.maybeBroadcastUnlocks(
          teamId,
          player.id,
          player.name,
          unlocked,
        );
        await this.postUnlocksToBattleforge(player.id, player.name, unlocked);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to record equip achievements for ${teamId}:${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getPlayerSummary(teamId: string, userId: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });
    await this.ensurePlayerStatsRow(player.id);

    const definitions = await this.getPlayerDefinitions();
    const unlocks = await this.prisma.playerAchievementUnlock.findMany({
      where: { playerId: player.id },
      include: {
        achievement: true,
      },
      orderBy: { unlockedAt: 'desc' },
    });

    return {
      unlockedCount: unlocks.length,
      totalCount: definitions.length,
      recentUnlocks: unlocks.slice(0, 3).map((unlock) => ({
        id: unlock.achievementId,
        name: unlock.achievement.name,
        description: unlock.achievement.description,
        unlockedAt: unlock.unlockedAt,
      })),
    };
  }

  async getPlayerAchievementList(teamId: string, userId: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });
    await this.ensurePlayerStatsRow(player.id);

    const definitions = await this.getPlayerDefinitions();
    const unlocks = await this.prisma.playerAchievementUnlock.findMany({
      where: { playerId: player.id },
      select: {
        achievementId: true,
        unlockedAt: true,
      },
    });

    const unlockedById = new Map(
      unlocks.map((unlock) => [unlock.achievementId, unlock.unlockedAt]),
    );
    const categoryOrder = [
      'RAID',
      'COMBAT',
      'ECONOMY',
      'SOCIAL',
      'GUILD',
      'SEASONAL',
      'SECRET',
    ];

    const categories = categoryOrder
      .map((category) => {
        const entries = definitions
          .filter((definition) => definition.category === category)
          .map((definition) => {
            const unlockedAt = unlockedById.get(definition.id);
            const isUnlocked = Boolean(unlockedAt);
            const isSecretLocked = definition.isSecret && !isUnlocked;

            return {
              id: definition.id,
              name: isSecretLocked ? '???' : definition.name,
              description: isSecretLocked
                ? 'Secret achievement. Unlock to reveal details.'
                : definition.description,
              category: definition.category,
              isSecret: definition.isSecret,
              isUnlocked,
              rewardType: definition.rewardType,
              rewardValue: definition.rewardValue,
              unlockedAt: unlockedAt ?? null,
            };
          });

        if (entries.length === 0) return null;

        return {
          category,
          achievements: entries,
        };
      })
      .filter(Boolean);

    return {
      summary: {
        unlockedCount: unlocks.length,
        totalCount: definitions.length,
      },
      categories,
    };
  }

  async getBroadcastConfig(teamId: string) {
    return this.getOrCreateBroadcastConfig(teamId);
  }

  async updateBroadcastConfig(input: {
    teamId: string;
    enabled?: boolean;
    channelId?: string | null;
    perPlayerCooldownSeconds?: number;
    globalCooldownSeconds?: number;
  }) {
    await touchWorkspaceActivity(input.teamId);

    return this.prisma.workspaceBroadcastConfig.upsert({
      where: { workspaceId: input.teamId },
      create: {
        workspaceId: input.teamId,
        enabled: input.enabled ?? false,
        channelId: input.channelId ?? null,
        perPlayerCooldownSeconds: Math.max(
          0,
          input.perPlayerCooldownSeconds ?? 3600,
        ),
        globalCooldownSeconds: Math.max(0, input.globalCooldownSeconds ?? 120),
      },
      update: {
        ...(typeof input.enabled === 'boolean'
          ? { enabled: input.enabled }
          : {}),
        ...(typeof input.channelId === 'string' || input.channelId === null
          ? { channelId: input.channelId }
          : {}),
        ...(typeof input.perPlayerCooldownSeconds === 'number'
          ? {
              perPlayerCooldownSeconds: Math.max(
                0,
                input.perPlayerCooldownSeconds,
              ),
            }
          : {}),
        ...(typeof input.globalCooldownSeconds === 'number'
          ? { globalCooldownSeconds: Math.max(0, input.globalCooldownSeconds) }
          : {}),
      },
    });
  }

  private async seedDefinitions(): Promise<void> {
    for (const definition of PLAYER_ACHIEVEMENT_DEFINITIONS) {
      await this.prisma.achievementDefinition.upsert({
        where: { id: definition.id },
        create: this.toDefinitionCreateInput(definition),
        update: this.toDefinitionUpdateInput(definition),
      });
    }
  }

  private toDefinitionCreateInput(definition: AchievementDefinitionSeed) {
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      scope: definition.scope,
      isSecret: definition.isSecret ?? false,
      isRepeatable: definition.isRepeatable ?? false,
      broadcastOnUnlock: definition.broadcastOnUnlock ?? false,
      broadcastTemplate: definition.broadcastTemplate ?? null,
      rewardType: definition.rewardType,
      rewardValue: definition.rewardValue ?? null,
      conditionType: definition.conditionType,
      conditionKey: definition.conditionKey ?? null,
      conditionValue: definition.conditionValue ?? null,
    } satisfies Prisma.AchievementDefinitionCreateInput;
  }

  private toDefinitionUpdateInput(definition: AchievementDefinitionSeed) {
    return {
      name: definition.name,
      description: definition.description,
      category: definition.category,
      scope: definition.scope,
      isSecret: definition.isSecret ?? false,
      isRepeatable: definition.isRepeatable ?? false,
      broadcastOnUnlock: definition.broadcastOnUnlock ?? false,
      broadcastTemplate: definition.broadcastTemplate ?? null,
      rewardType: definition.rewardType,
      rewardValue: definition.rewardValue ?? null,
      conditionType: definition.conditionType,
      conditionKey: definition.conditionKey ?? null,
      conditionValue: definition.conditionValue ?? null,
    } satisfies Prisma.AchievementDefinitionUpdateInput;
  }

  private async ensurePlayerStatsRow(
    playerId: number,
  ): Promise<PlayerAchievementStats> {
    return this.prisma.playerAchievementStats.upsert({
      where: { playerId },
      create: { playerId },
      update: {},
    });
  }

  private async getPlayerDefinitions(): Promise<AchievementDefinition[]> {
    return this.prisma.achievementDefinition.findMany({
      where: { scope: AchievementScope.PLAYER },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
  }

  private async evaluateAndUnlockPlayerAchievements(input: {
    playerId: number;
    stats: PlayerAchievementStats;
    context: AchievementEvaluationContext;
  }): Promise<UnlockedAchievement[]> {
    const definitions = await this.getPlayerDefinitions();

    return this.prisma.$transaction(async (tx) => {
      const unlocks = await tx.playerAchievementUnlock.findMany({
        where: { playerId: input.playerId },
        select: { achievementId: true },
      });
      const unlockedIds = new Set(
        unlocks.map((unlock) => unlock.achievementId),
      );

      const newlyUnlocked: UnlockedAchievement[] = [];
      for (const definition of definitions) {
        if (unlockedIds.has(definition.id)) continue;
        if (!this.matchesDefinition(definition, input.stats, input.context)) {
          continue;
        }

        try {
          await tx.playerAchievementUnlock.create({
            data: {
              playerId: input.playerId,
              achievementId: definition.id,
            },
          });
          newlyUnlocked.push({
            id: definition.id,
            name: definition.name,
            description: definition.description,
            broadcastOnUnlock: definition.broadcastOnUnlock,
            broadcastTemplate: definition.broadcastTemplate,
          });
          unlockedIds.add(definition.id);
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          ) {
            throw error;
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        await tx.playerAchievementStats.update({
          where: { playerId: input.playerId },
          data: {
            lastAchievementAt: new Date(),
          },
        });
      }

      return newlyUnlocked;
    });
  }

  private matchesDefinition(
    definition: AchievementDefinition,
    stats: PlayerAchievementStats,
    context: AchievementEvaluationContext,
  ): boolean {
    const threshold = Number(definition.conditionValue ?? '0');

    if (
      definition.conditionType === AchievementConditionType.THRESHOLD ||
      definition.conditionType === AchievementConditionType.STREAK ||
      definition.conditionType === AchievementConditionType.RECORD
    ) {
      const key = definition.conditionKey;
      if (!key) return false;
      const value = Number(
        (stats as unknown as Record<string, unknown>)[key] ?? 0,
      );
      return value >= threshold;
    }

    if (definition.conditionType === AchievementConditionType.EVENT) {
      if (context.source !== 'run') return false;

      switch (definition.id) {
        case 'R007':
          return (
            context.runStatus === RunStatus.CASHED_OUT &&
            context.bankedGold >= threshold
          );
        case 'R008':
          return context.continuesCount >= threshold;
        case 'C005':
          return (
            context.runStatus === RunStatus.CASHED_OUT &&
            context.damageTakenThisRun === 0
          );
        case 'C006':
          return context.biggestHitThisRun >= threshold;
        case 'X001':
          return (
            context.runStatus === RunStatus.CASHED_OUT && context.closeCall
          );
        case 'X002':
          return (
            context.runStatus === RunStatus.FAILED &&
            context.greedyLoss &&
            context.continuesCount >= threshold
          );
        default:
          return false;
      }
    }

    return false;
  }

  private async sendUnlockDm(
    teamId: string,
    userId: string,
    playerId: number,
    unlocked: UnlockedAchievement[],
  ): Promise<void> {
    const title =
      unlocked.length === 1
        ? '🏅 Achievement unlocked!'
        : `🏅 ${unlocked.length} achievements unlocked!`;
    const lines = unlocked.map(
      (achievement) => `• *${achievement.name}* — ${achievement.description}`,
    );

    await this.eventBridge.publishNotification({
      type: 'achievement',
      event: {
        eventType: 'achievement:unlock',
        playerId,
        teamId,
        userId,
        achievementIds: unlocked.map((entry) => entry.id),
        timestamp: new Date(),
      },
      recipients: [
        {
          clientType: 'slack',
          teamId,
          userId,
          message: `${title}\n${lines.join('\n')}`,
          priority: 'normal',
        },
      ],
    });
  }

  private async postUnlocksToBattleforge(
    playerId: number,
    playerName: string,
    unlocked: UnlockedAchievement[],
  ): Promise<void> {
    const broadcasts = unlocked.filter((u) => u.broadcastOnUnlock);
    if (broadcasts.length === 0) return;

    const names = broadcasts.map((b) => `*${b.name}*`).join(', ');
    const message = `🏆 ${playerName} unlocked ${names}!`;

    const broadcastEvent = {
      eventType: 'achievement:unlock' as const,
      playerId,
      teamId: '',
      userId: '',
      achievementIds: broadcasts.map((b) => b.id),
      broadcastAchievementIds: broadcasts.map((b) => b.id),
      timestamp: new Date(),
    };

    const battleforgeRecipients = await buildBattleforgeRecipients(message);
    if (battleforgeRecipients.length > 0) {
      await this.eventBridge.publishNotification({
        type: 'announcement',
        event: broadcastEvent,
        recipients: battleforgeRecipients,
      });
    }
  }

  private async maybeBroadcastUnlocks(
    teamId: string,
    playerId: number,
    playerName: string,
    unlocked: UnlockedAchievement[],
  ): Promise<void> {
    if (unlocked.length === 0) return;

    const config = await this.getOrCreateBroadcastConfig(teamId);
    if (!config.enabled || !config.channelId) {
      return;
    }

    for (const achievement of unlocked) {
      if (!achievement.broadcastOnUnlock) continue;

      const now = Date.now();
      const latestGlobal = await this.prisma.achievementBroadcastLog.findFirst({
        where: { workspaceId: teamId },
        orderBy: { broadcastedAt: 'desc' },
      });
      if (
        latestGlobal &&
        now - latestGlobal.broadcastedAt.getTime() <
          config.globalCooldownSeconds * 1000
      ) {
        continue;
      }

      const latestPerPlayer =
        await this.prisma.achievementBroadcastLog.findFirst({
          where: {
            workspaceId: teamId,
            playerId,
          },
          orderBy: { broadcastedAt: 'desc' },
        });
      if (
        latestPerPlayer &&
        now - latestPerPlayer.broadcastedAt.getTime() <
          config.perPlayerCooldownSeconds * 1000
      ) {
        continue;
      }

      const duplicateSince = new Date(now - 24 * 60 * 60 * 1000);
      const duplicate = await this.prisma.achievementBroadcastLog.findFirst({
        where: {
          workspaceId: teamId,
          playerId,
          achievementId: achievement.id,
          broadcastedAt: { gte: duplicateSince },
        },
      });
      if (duplicate) {
        continue;
      }

      const template =
        achievement.broadcastTemplate ??
        '🏆 {playerName} unlocked *{achievementName}*!';
      const message = template
        .replaceAll('{playerName}', playerName)
        .replaceAll('{achievementName}', achievement.name)
        .replaceAll('{achievementDescription}', achievement.description);

      const broadcastEvent = {
        eventType: 'achievement:unlock' as const,
        playerId,
        teamId,
        userId: '',
        achievementIds: [achievement.id],
        broadcastAchievementIds: [achievement.id],
        timestamp: new Date(),
      };

      await this.eventBridge.publishNotification({
        type: 'announcement',
        event: broadcastEvent,
        recipients: [
          {
            clientType: 'slack-channel' as const,
            teamId,
            channelId: config.channelId,
            message,
            priority: 'normal' as const,
          },
        ],
      });

      await this.prisma.achievementBroadcastLog.create({
        data: {
          workspaceId: teamId,
          playerId,
          achievementId: achievement.id,
        },
      });
    }
  }

  private async getOrCreateBroadcastConfig(
    workspaceId: string,
  ): Promise<WorkspaceBroadcastConfig> {
    await touchWorkspaceActivity(workspaceId);

    return this.prisma.workspaceBroadcastConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        enabled: false,
        channelId: null,
        perPlayerCooldownSeconds: 3600,
        globalCooldownSeconds: 120,
      },
      update: {},
    });
  }

  private setIncrement(
    updateData: Prisma.PlayerAchievementStatsUpdateInput,
    field: keyof Prisma.PlayerAchievementStatsUpdateInput,
    value: number,
  ): void {
    if (value <= 0) return;
    (updateData as Record<string, unknown>)[field as string] = {
      increment: value,
    };
  }
}
