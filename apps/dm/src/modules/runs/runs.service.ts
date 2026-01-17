import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getPrismaClient,
  RunStatus,
  RunType,
  TicketTier,
  type PlayerWithSlackUser,
} from '@mud/database';
import { PlayerService } from '../../app/player/player.service';
import { CombatService } from '../../app/combat/combat.service';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { GuildsService } from '../guilds/guilds.service';
import {
  calculateAttackRating,
  calculateBaseDamage,
  calculateCoreDamage,
  calculateDefenseRating,
  calculateMitigation,
  estimateWeaponDamage,
  runTeamCombat,
  toEffectiveStats,
} from '../../app/combat/engine';
import { serializeCombatLog } from '../../app/combat/combat-log.util';
import type { Combatant } from '../../app/combat/types';
import {
  MONSTER_TEMPLATES,
  VARIANT_CONFIG,
  formatMonsterName,
  rollVariant,
} from '../../app/monster/monster.types';
import type { MonsterTemplate } from '../../app/monster/monster.types';
import {
  formatWebRecipientId,
  type NotificationRecipient,
} from '@mud/redis-client';
import { AppError, ErrCodes } from '../../app/errors/app-error';

const RUN_ACTION_CONTINUE = 'run_action_continue';
const RUN_ACTION_FINISH = 'run_action_finish';
const COMBAT_ACTION_SHOW_LOG = 'combat_action_show_log';
const BASE_DIFFICULTY = 0.9;
const ROUND_DIFFICULTY_STEP = 0.15;
const ROUND_REWARD_STEP = 0.2;
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.5;
const GUILD_DIFFICULTY_MULTIPLIER = 0.9;

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

  async startRun(teamId: string, userId: string, runType: RunType) {
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
      throw new BadRequestException(
        'Only the raid leader can finish the raid.',
      );
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

    const depth = Math.max(1, runWithParticipants.round ?? 1);
    const ticketReward = this.rollTicketReward(depth);
    const ticketMessage = ticketReward
      ? `Ticket reward: ${this.formatTicketLabel(ticketReward)}.`
      : null;

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

      await this.playerService.updatePlayerStats(
        slackUser.teamId,
        slackUser.userId,
        {
          xp: current.xp + bankedXp,
          gold: current.gold + bankedGold,
        },
      );

      if (ticketReward) {
        await this.prisma.player.update({
          where: { id: participant.playerId },
          data: this.buildTicketUpdate(ticketReward),
        });
      }
    }

    runWithParticipants.status = RunStatus.CASHED_OUT;
    runWithParticipants.endedAt = endTime;

    const baseMessage = `Raid complete! You earned ${bankedXp} XP and ${bankedGold} gold.`;
    const fullMessage = ticketMessage
      ? `${baseMessage}\n${ticketMessage}`
      : baseMessage;

    await this.publishRunEndNotifications(runWithParticipants, {
      status: RunStatus.CASHED_OUT,
      message: fullMessage,
    });

    return runWithParticipants;
  }

  private rollTicketReward(depth: number): TicketTier | null {
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const pRare = clamp(0.1 + 0.02 * depth, 0.1, 0.6);
    const pEpic = clamp(0.02 + 0.01 * depth, 0.02, 0.25);
    const pLegendary = clamp(0.005 + 0.002 * depth, 0.005, 0.05);

    const roll = Math.random();
    if (roll < pLegendary) {
      return TicketTier.Legendary;
    }
    if (roll < pEpic) {
      return TicketTier.Epic;
    }
    if (roll < pRare) {
      return TicketTier.Rare;
    }
    return null;
  }

  private buildTicketUpdate(ticket: TicketTier): {
    rareTickets?: { increment: number };
    epicTickets?: { increment: number };
    legendaryTickets?: { increment: number };
  } {
    if (ticket === TicketTier.Legendary) {
      return { legendaryTickets: { increment: 1 } };
    }
    if (ticket === TicketTier.Epic) {
      return { epicTickets: { increment: 1 } };
    }
    return { rareTickets: { increment: 1 } };
  }

  private formatTicketLabel(ticket: TicketTier): string {
    if (ticket === TicketTier.Legendary) return 'Legendary Ticket';
    if (ticket === TicketTier.Epic) return 'Epic Ticket';
    return 'Rare Ticket';
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

    const leader = run.participants.find(
      (participant) => participant.playerId === leaderId,
    );
    if (!leader) {
      throw new BadRequestException('Raid leader not found.');
    }

    const roundNumber = run.round + 1;
    const partyCombatants = await this.buildPartyCombatants(run.participants);
    const partySummary = this.buildPartySummaryCombatant(partyCombatants);
    const { monster, difficultyTier, rewardMultiplier } =
      this.buildScaledEncounter(partyCombatants, roundNumber, {
        isGuild: run.runType === RunType.GUILD,
      });

    const partyName =
      partyCombatants.length === 1 ? partyCombatants[0].name : 'Raid party';
    const combatLog = await runTeamCombat(
      partyCombatants,
      [monster],
      this.logger,
      undefined,
      { teamAName: partyName, teamBName: monster.name },
    );

    const totalDamage = combatLog.rounds.reduce(
      (total, round) => total + round.damage,
      0,
    );
    await this.prisma.combatLog.create({
      data: {
        combatId: combatLog.combatId,
        attackerId: leader.playerId,
        attackerType: 'player',
        defenderId: monster.id,
        defenderType: 'monster',
        damage: totalDamage,
        log: serializeCombatLog(combatLog),
        runId: run.id,
        runRound: roundNumber,
      },
    });

    const combatLogText = this.combatService.formatCombatLog(combatLog, {
      attackerCombatant:
        partyCombatants.length === 1 ? partyCombatants[0] : partySummary,
      defenderCombatant: monster,
      combatants: partyCombatants.length > 1 ? partyCombatants : undefined,
    });
    const playerWon = partyCombatants.some((combatant) => combatant.isAlive);

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
        blocks: this.buildParticipantBlocks(
          `${summary}\n${rewards}`,
          combatLog.combatId,
        ),
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
      combatId: combatLog.combatId,
    });
  }

  private async buildPartyCombatants(
    participants: Array<{ player: PlayerWithSlackUser }>,
  ): Promise<Combatant[]> {
    const combatants = await Promise.all(
      participants.map(async (participant) => {
        const slackUser = participant.player.slackUser;
        if (!slackUser) {
          throw new BadRequestException(
            'Raid participant is missing Slack identity.',
          );
        }

        const combatant = await this.combatService.buildPlayerCombatant(
          slackUser.teamId,
          slackUser.userId,
        );
        combatant.hp = combatant.maxHp;
        combatant.isAlive = true;
        return combatant;
      }),
    );

    return combatants;
  }

  private buildPartySummaryCombatant(combatants: Combatant[]): Combatant {
    const total = combatants.reduce(
      (acc, combatant) => {
        acc.hp += combatant.hp;
        acc.maxHp += combatant.maxHp;
        acc.strength += combatant.strength;
        acc.agility += combatant.agility;
        acc.health += combatant.health;
        acc.level += combatant.level;
        return acc;
      },
      { hp: 0, maxHp: 0, strength: 0, agility: 0, health: 0, level: 0 },
    );

    const count = Math.max(1, combatants.length);
    return {
      id: -1,
      name: combatants.length === 1 ? combatants[0].name : 'Raid party',
      type: 'player',
      hp: total.hp,
      maxHp: total.maxHp,
      strength: Math.round(total.strength / count),
      agility: Math.round(total.agility / count),
      health: Math.round(total.health / count),
      level: Math.max(1, Math.round(total.level / count)),
      isAlive: combatants.some((combatant) => combatant.isAlive),
    };
  }

  private calculateRewardMultiplier(round: number, scale: number) {
    const roundBoost = (round - 1) * ROUND_REWARD_STEP;
    const scaleBoost = Math.max(0, scale - 1) * 0.5;
    return Math.max(1, 1 + roundBoost + scaleBoost);
  }

  private calculateCombatantPower(combatant: Combatant): number {
    const effectiveStats = toEffectiveStats(combatant);
    const weaponAverage = estimateWeaponDamage(combatant.damageRoll ?? '1d4');
    const coreDamage = calculateCoreDamage(effectiveStats);
    const baseDamage = calculateBaseDamage(coreDamage, weaponAverage);
    const attackRating = calculateAttackRating(effectiveStats);
    const defenseRating = calculateDefenseRating(effectiveStats);
    const mitigation = calculateMitigation(effectiveStats);

    const offenseScore = baseDamage * 4 + attackRating * 0.5;
    const defenseScore =
      combatant.maxHp * 0.6 + defenseRating * 0.4 + mitigation * 50;
    const levelScore = combatant.level * 4;
    return Math.max(1, Math.round(offenseScore + defenseScore + levelScore));
  }

  private calculateTemplatePower(template: MonsterTemplate): number {
    const baseMaxHp = template.baseHp + template.health * 2;
    return this.calculateCombatantPower({
      id: 0,
      name: template.name,
      type: 'monster',
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      strength: template.strength,
      agility: template.agility,
      health: template.health,
      level: template.tier,
      isAlive: true,
      damageRoll: template.damageRoll,
    });
  }

  private selectTemplateForPower(targetPower: number) {
    const templates = MONSTER_TEMPLATES.map((template) => ({
      template,
      power: this.calculateTemplatePower(template),
    })).sort((a, b) => a.power - b.power);

    let chosen = templates[0];
    for (const entry of templates) {
      if (entry.power <= targetPower) {
        chosen = entry;
      } else {
        break;
      }
    }

    return chosen;
  }

  private buildScaledEncounter(
    party: Combatant[],
    round: number,
    options?: { isGuild?: boolean },
  ) {
    const partyPower = party.reduce(
      (total, combatant) => total + this.calculateCombatantPower(combatant),
      0,
    );
    const difficultyMultiplier =
      (BASE_DIFFICULTY + (round - 1) * ROUND_DIFFICULTY_STEP) *
      (options?.isGuild ? GUILD_DIFFICULTY_MULTIPLIER : 1);
    const targetPower = partyPower * difficultyMultiplier;
    const selection = this.selectTemplateForPower(targetPower);
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, targetPower / selection.power),
    );

    return {
      monster: this.buildRunMonster(selection.template, scale),
      difficultyTier: selection.template.tier,
      rewardMultiplier: this.calculateRewardMultiplier(round, scale),
    };
  }

  private buildRunMonster(template: MonsterTemplate, scale: number): Combatant {
    const variant = rollVariant();
    const variantConfig = VARIANT_CONFIG[variant];
    const variance = () => Math.floor(Math.random() * 5) - 2;

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

    const baseMaxHp = Math.max(
      1,
      Math.floor(template.baseHp * scale) + health * 2,
    );
    const maxHp = Math.max(
      1,
      Math.floor(baseMaxHp * variantConfig.hpMultiplier),
    );

    const displayName = formatMonsterName(template.name, variant);
    const level = Math.max(1, Math.round(template.tier * scale));

    return {
      id: -Math.floor(Math.random() * 1_000_000) - template.tier,
      name: displayName,
      type: 'monster',
      hp: maxHp,
      maxHp,
      strength,
      agility,
      health,
      level,
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
    combatId?: string;
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
            ...(params.combatId ? { value: params.combatId } : {}),
          },
        ],
      },
    ];
  }

  private buildParticipantBlocks(summary: string, combatId?: string) {
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
            ...(combatId ? { value: combatId } : {}),
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
      combatId?: string;
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
              combatId: params.combatId,
            })
          : this.buildParticipantBlocks(participantSummary, params.combatId),
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
    params: {
      status: RunStatus;
      message: string;
      blocks?: Array<Record<string, unknown>>;
    },
  ) {
    if (!run) return;

    const recipients: NotificationRecipient[] = [];
    const webMessage =
      params.status === RunStatus.CASHED_OUT
        ? 'Raid complete. Updating your character.'
        : 'Raid ended. Updating your character.';
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
      recipients.push({
        clientType: 'web',
        teamId: undefined,
        userId: formatWebRecipientId(slackUser.teamId, slackUser.userId),
        message: webMessage,
        priority: 'normal',
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
