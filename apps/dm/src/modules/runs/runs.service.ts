import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getPrismaClient,
  RunStatus,
  RunType,
  type PlayerWithSlackUser,
} from '@mud/database';
import { PlayerService } from '../../app/player/player.service';
import { CombatService } from '../../app/combat/combat.service';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { GuildsService } from '../guilds/guilds.service';
import { runCombat } from '../../app/combat/engine';
import type { Combatant } from '../../app/combat/types';
import {
  MONSTER_TEMPLATES,
  VARIANT_CONFIG,
  formatMonsterName,
  rollVariant,
} from '../../app/monster/monster.types';
import type { NotificationRecipient } from '@mud/redis-client';
import { AppError, ErrCodes } from '../../app/errors/app-error';

const RUN_ACTION_CONTINUE = 'run_action_continue';
const RUN_ACTION_FINISH = 'run_action_finish';
const COMBAT_ACTION_SHOW_LOG = 'combat_action_show_log';

@Injectable()
export class RunsService {
  private prisma = getPrismaClient();
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly combatService: CombatService,
    private readonly eventBridge: EventBridgeService,
    private readonly guildsService: GuildsService,
  ) {}

  async getActiveRunForPlayer(playerId: number) {
    return this.prisma.runParticipant.findFirst({
      where: {
        playerId,
        run: { status: RunStatus.ACTIVE },
      },
      include: {
        run: true,
      },
    });
  }

  async getActiveRunForTeamUser(teamId: string, userId: string) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });
    const active = await this.getActiveRunForPlayer(player.id);
    return active?.run ?? null;
  }

  async getRunById(runId: number) {
    return this.prisma.run.findUnique({ where: { id: runId } });
  }

  async ensurePlayerNotInRun(playerId: number, message: string) {
    const active = await this.getActiveRunForPlayer(playerId);
    if (active) {
      throw new AppError(ErrCodes.RUN_ACTIVE, message, {
        runId: active.runId,
      });
    }
  }

  async startRun(
    teamId: string,
    userId: string,
    runType: RunType,
  ) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const { participants, guildId } = await this.resolveParticipants(
      player.id,
      runType,
    );

    const activeRun = await this.findActiveRunForPlayers(
      participants.map((member) => member.playerId),
    );
    if (activeRun) {
      throw new BadRequestException(
        'A guild member is already in an active raid.',
      );
    }

    const createdRun = await this.prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: {
          runType,
          status: RunStatus.ACTIVE,
          round: 0,
          bankedXp: 0,
          bankedGold: 0,
          difficultyTier: 1,
          leaderPlayerId: player.id,
          guildId: runType === RunType.GUILD ? guildId : null,
        },
      });

      await tx.runParticipant.createMany({
        data: participants.map((member) => ({
          runId: run.id,
          playerId: member.playerId,
          isLeader: member.isLeader,
        })),
      });

      return run;
    });

    await this.resolveNextRound(createdRun.id, player.id);

    return createdRun;
  }

  async continueRun(teamId: string, userId: string, runId?: number) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const run = await this.requireActiveRun(runId, player.id);
    if (run.leaderPlayerId !== player.id) {
      throw new BadRequestException('Only the raid leader can continue.');
    }

    await this.resolveNextRound(run.id, player.id);
    return run;
  }

  async finishRun(teamId: string, userId: string, runId?: number) {
    const player = await this.playerService.getPlayer(teamId, userId, {
      requireCreationComplete: true,
    });

    const run = await this.requireActiveRun(runId, player.id);
    if (run.leaderPlayerId !== player.id) {
      throw new BadRequestException('Only the raid leader can finish the raid.');
    }

    const runWithParticipants = await this.loadRunWithParticipants(run.id);
    if (!runWithParticipants) {
      throw new BadRequestException('Raid not found.');
    }

    const endTime = new Date();
    await this.prisma.run.update({
      where: { id: run.id },
      data: { status: RunStatus.CASHED_OUT, endedAt: endTime },
    });

    const bankedXp = runWithParticipants.bankedXp;
    const bankedGold = runWithParticipants.bankedGold;

    for (const participant of runWithParticipants.participants) {
      const slackUser = participant.player.slackUser;
      if (!slackUser) {
        this.logger.warn(
          `Skipping rewards for player ${participant.playerId}; missing Slack user`,
        );
        continue;
      }

      const current = await this.playerService.getPlayer(
        slackUser.teamId,
        slackUser.userId,
        { requireCreationComplete: true },
      );

      await this.playerService.updatePlayerStats(slackUser.teamId, slackUser.userId, {
        xp: current.xp + bankedXp,
        gold: current.gold + bankedGold,
      });
    }

    runWithParticipants.status = RunStatus.CASHED_OUT;
    runWithParticipants.endedAt = endTime;

    await this.publishRunEndNotifications(runWithParticipants, {
      status: RunStatus.CASHED_OUT,
      message: `Raid complete! You earned ${bankedXp} XP and ${bankedGold} gold.`,
    });

    return runWithParticipants;
  }

  private async resolveParticipants(playerId: number, runType: RunType) {
    if (runType === RunType.SOLO) {
      const player = await this.prisma.player.findUnique({
        where: { id: playerId },
        include: { slackUser: true },
      });
      if (!player) {
        throw new BadRequestException('Player not found.');
      }
      return {
        guildId: null,
        participants: [
          {
            playerId: player.id,
            isLeader: true,
            player: player as PlayerWithSlackUser,
          },
        ],
      };
    }

    const guild = await this.guildsService.getGuildWithMembers(playerId);
    if (!guild) {
      throw new BadRequestException('You are not in a guild.');
    }

    return {
      guildId: guild.guild.id,
      participants: guild.members.map((member) => ({
        playerId: member.playerId,
        isLeader: member.playerId === playerId,
        player: member.player as PlayerWithSlackUser,
      })),
    };
  }

  private async requireActiveRun(runId: number | undefined, playerId: number) {
    if (runId) {
      const participant = await this.prisma.runParticipant.findUnique({
        where: { runId_playerId: { runId, playerId } },
        include: { run: true },
      });
      if (!participant?.run || participant.run.status !== RunStatus.ACTIVE) {
        throw new BadRequestException('No active raid found.');
      }
      return participant.run;
    }

    const active = await this.getActiveRunForPlayer(playerId);
    if (!active?.run) {
      throw new BadRequestException('No active raid found.');
    }
    return active.run;
  }

  private async findActiveRunForPlayers(playerIds: number[]) {
    return this.prisma.runParticipant.findFirst({
      where: {
        playerId: { in: playerIds },
        run: { status: RunStatus.ACTIVE },
      },
      include: { run: true },
    });
  }

  private async loadRunWithParticipants(runId: number) {
    return this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        participants: {
          include: {
            player: {
              include: { slackUser: true, guildMembership: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        guild: true,
        leader: { include: { slackUser: true } },
      },
    });
  }

  private async resolveNextRound(runId: number, leaderId: number) {
    const run = await this.loadRunWithParticipants(runId);
    if (!run) {
      throw new BadRequestException('Raid not found.');
    }

    if (run.status !== RunStatus.ACTIVE) {
      throw new BadRequestException('Raid is no longer active.');
    }

    const leader = run.participants.find((participant) =>
      participant.playerId === leaderId,
    );
    if (!leader) {
      throw new BadRequestException('Raid leader not found.');
    }

    const roundNumber = run.round + 1;
    const memberCount = run.participants.length;
    const difficultyTier = this.calculateDifficultyTier(roundNumber, memberCount);
    const rewardMultiplier = this.calculateRewardMultiplier(
      roundNumber,
      memberCount,
    );

    const leaderSlack = leader.player.slackUser;
    if (!leaderSlack) {
      throw new BadRequestException('Raid leader is missing Slack identity.');
    }

    const playerCombatant = await this.combatService.buildPlayerCombatant(
      leaderSlack.teamId,
      leaderSlack.userId,
    );
    playerCombatant.hp = playerCombatant.maxHp;
    playerCombatant.isAlive = true;

    const monster = this.buildRunMonster(difficultyTier, roundNumber, memberCount);

    const combatLog = await runCombat(playerCombatant, monster, this.logger);
    const playerWon = combatLog.winner === playerCombatant.name;
    const combatLogText = this.combatService.formatCombatLog(combatLog, {
      attackerCombatant: playerCombatant,
      defenderCombatant: monster,
    });

    if (!playerWon) {
      const endTime = new Date();
      await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: RunStatus.FAILED,
          endedAt: endTime,
          bankedXp: 0,
          bankedGold: 0,
        },
      });

      run.status = RunStatus.FAILED;
      run.endedAt = endTime;
      run.bankedXp = 0;
      run.bankedGold = 0;

      const summary = `Raid failed. Round ${roundNumber} complete. ${monster.name} defeated the party.`;
      const rewards = 'Banked rewards: 0 XP, 0 gold.';
      await this.publishRunEndNotifications(run, {
        status: RunStatus.FAILED,
        message: `${summary}\n${rewards}\n\n${combatLogText}`,
        blocks: this.buildParticipantBlocks(`${summary}\n${rewards}`),
      });

      return;
    }

    const roundXp = Math.max(
      0,
      Math.floor(combatLog.xpAwarded * rewardMultiplier),
    );
    const roundGold = Math.max(
      0,
      Math.floor((combatLog.goldAwarded ?? 0) * rewardMultiplier),
    );
    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        round: roundNumber,
        bankedXp: { increment: roundXp },
        bankedGold: { increment: roundGold },
        difficultyTier,
      },
    });

    await this.publishRunRoundNotifications(run, {
      round: roundNumber,
      monsterName: monster.name,
      roundXp,
      roundGold,
      bankedXp: run.bankedXp + roundXp,
      bankedGold: run.bankedGold + roundGold,
      combatLogText,
    });
  }

  private calculateDifficultyTier(round: number, memberCount: number) {
    const base = 1 + Math.floor((round - 1) / 2);
    const guildBonus = Math.floor((memberCount - 1) / 2);
    return Math.min(5, base + guildBonus);
  }

  private calculateRewardMultiplier(round: number, memberCount: number) {
    const roundBoost = (round - 1) * 0.2;
    const partyBoost = (memberCount - 1) * 0.15;
    return 1 + roundBoost + partyBoost;
  }

  private selectTemplateForTier(tier: number) {
    const exact = MONSTER_TEMPLATES.filter((template) => template.tier === tier);
    if (exact.length > 0) {
      return exact[Math.floor(Math.random() * exact.length)];
    }

    const fallback = MONSTER_TEMPLATES.filter((template) => template.tier <= tier);
    if (fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }

    return MONSTER_TEMPLATES[Math.floor(Math.random() * MONSTER_TEMPLATES.length)];
  }

  private buildRunMonster(
    tier: number,
    round: number,
    memberCount: number,
  ): Combatant {
    const template = this.selectTemplateForTier(tier);
    const variant = rollVariant();
    const variantConfig = VARIANT_CONFIG[variant];
    const variance = () => Math.floor(Math.random() * 5) - 2;

    const scale = 1 + (round - 1) * 0.05 + (memberCount - 1) * 0.03;

    const strength = Math.max(
      1,
      Math.floor(
        (template.strength + variance() + variantConfig.statModifier) * scale,
      ),
    );
    const agility = Math.max(
      1,
      Math.floor(
        (template.agility + variance() + variantConfig.statModifier) * scale,
      ),
    );
    const health = Math.max(
      1,
      Math.floor(
        (template.health + variance() + variantConfig.statModifier) * scale,
      ),
    );

    const baseMaxHp = template.baseHp + health * 2;
    const maxHp = Math.max(
      1,
      Math.floor(baseMaxHp * variantConfig.hpMultiplier * scale),
    );

    const displayName = formatMonsterName(template.name, variant);

    return {
      id: -Math.floor(Math.random() * 1_000_000) - tier,
      name: displayName,
      type: 'monster',
      hp: maxHp,
      maxHp,
      strength,
      agility,
      level: Math.max(1, tier),
      isAlive: true,
      damageRoll: template.damageRoll,
    };
  }

  private buildLeaderBlocks(params: {
    runId: number;
    round: number;
    monsterName: string;
    bankedXp: number;
    bankedGold: number;
    roundXp: number;
    roundGold: number;
  }) {
    const summary = `Round ${params.round} complete. ${params.monsterName} was defeated.`;
    const rewards = `Banked rewards: ${params.bankedXp} XP, ${params.bankedGold} gold (+${params.roundXp} XP, +${params.roundGold} gold this round).`;

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${summary}\n${rewards}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Continue', emoji: true },
            style: 'primary',
            action_id: RUN_ACTION_CONTINUE,
            value: String(params.runId),
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Finish Raid', emoji: true },
            style: 'danger',
            action_id: RUN_ACTION_FINISH,
            value: String(params.runId),
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View full combat log' },
            action_id: COMBAT_ACTION_SHOW_LOG,
          },
        ],
      },
    ];
  }

  private buildParticipantBlocks(summary: string) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summary,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View full combat log' },
            action_id: COMBAT_ACTION_SHOW_LOG,
          },
        ],
      },
    ];
  }

  private async publishRunRoundNotifications(
    run: Awaited<ReturnType<RunsService['loadRunWithParticipants']>>,
    params: {
      round: number;
      monsterName: string;
      roundXp: number;
      roundGold: number;
      bankedXp: number;
      bankedGold: number;
      combatLogText: string;
    },
  ) {
    if (!run) return;

    const recipients: NotificationRecipient[] = [];
    for (const participant of run.participants) {
      const slackUser = participant.player.slackUser;
      if (!slackUser) continue;

      const isLeader = participant.playerId === run.leaderPlayerId;
      const leaderSummary = `Round ${params.round} complete. ${params.monsterName} was defeated.`;
      const rewards = `Banked rewards: ${params.bankedXp} XP, ${params.bankedGold} gold (+${params.roundXp} XP, +${params.roundGold} gold this round).`;
      const participantSummary = `Guild raid round ${params.round} complete. Banked rewards: ${params.bankedXp} XP, ${params.bankedGold} gold.`;
      const message = isLeader
        ? `${leaderSummary}\n${rewards}\n\n${params.combatLogText}`
        : `${participantSummary}\n\n${params.combatLogText}`;

      recipients.push({
        clientType: 'slack',
        teamId: slackUser.teamId,
        userId: slackUser.userId,
        message,
        blocks: isLeader
          ? this.buildLeaderBlocks({
              runId: run.id,
              round: params.round,
              monsterName: params.monsterName,
              bankedXp: params.bankedXp,
              bankedGold: params.bankedGold,
              roundXp: params.roundXp,
              roundGold: params.roundGold,
            })
          : this.buildParticipantBlocks(participantSummary),
      });
    }

    await this.eventBridge.publishNotification({
      type: 'run',
      event: {
        eventType: 'run:round',
        runId: run.id,
        runType: run.runType,
        round: params.round,
        bankedXp: params.bankedXp,
        bankedGold: params.bankedGold,
        leaderId: run.leaderPlayerId,
        guildId: run.guildId ?? undefined,
        timestamp: new Date(),
      },
      recipients,
    });
  }

  private async publishRunEndNotifications(
    run: Awaited<ReturnType<RunsService['loadRunWithParticipants']>>,
    params: { status: RunStatus; message: string; blocks?: Array<Record<string, unknown>> },
  ) {
    if (!run) return;

    const recipients: NotificationRecipient[] = [];
    for (const participant of run.participants) {
      const slackUser = participant.player.slackUser;
      if (!slackUser) continue;
      recipients.push({
        clientType: 'slack',
        teamId: slackUser.teamId,
        userId: slackUser.userId,
        message: params.message,
        blocks: params.blocks,
      });
    }

    await this.eventBridge.publishNotification({
      type: 'run',
      event: {
        eventType: 'run:end',
        runId: run.id,
        runType: run.runType,
        status: params.status,
        bankedXp: run.bankedXp,
        bankedGold: run.bankedGold,
        leaderId: run.leaderPlayerId,
        guildId: run.guildId ?? undefined,
        timestamp: new Date(),
      },
      recipients,
    });
  }
}
