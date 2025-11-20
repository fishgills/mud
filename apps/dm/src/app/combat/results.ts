import { EventBus, type PlayerRespawnEvent } from '../../shared/event-bus';
import type { PlayerService } from '../player/player.service';
import type { PrismaClient } from '@mud/database';
import { Logger } from '@nestjs/common';
import type { DetailedCombatLog } from '../api';
import type { Combatant } from './types';
import { AttackOrigin } from '../api/dto/player-requests.dto';

export interface CombatResultEffects {
  playerRespawnEvents: PlayerRespawnEvent[];
}

export async function applyCombatResults(
  combatLog: DetailedCombatLog,
  combatant1: Combatant,
  combatant2: Combatant,
  playerService: PlayerService,
  prisma: PrismaClient,
  logger: Logger,
  options: { attackOrigin?: AttackOrigin } = {},
): Promise<CombatResultEffects> {
  logger.debug(`🔄 Applying combat results for combat ${combatLog.combatId}`);

  const winner = combatant1.name === combatLog.winner ? combatant1 : combatant2;
  const loser = combatant1.name === combatLog.loser ? combatant1 : combatant2;

  const attackOrigin =
    options.attackOrigin ??
    (winner.type === 'monster' || loser.type === 'monster'
      ? AttackOrigin.TEXT_PVE
      : AttackOrigin.TEXT_PVP);

  const playerRespawnEvents: PlayerRespawnEvent[] = [];

  logger.debug(
    `Winner: ${winner.name} (${winner.type}, ID: ${winner.id}), Loser: ${loser.name} (${loser.type}, ID: ${loser.id}), origin=${attackOrigin}`,
  );

  if (loser.type === 'player') {
    logger.debug(`Loser is a player, processing respawn or health restore...`);

    logger.debug(
      `Loser is ${loser.slackUser?.teamId}:${loser.slackUser?.userId}`,
    );
    if (!loser.slackUser?.teamId || !loser.slackUser?.userId) {
      throw new Error(
        `Player ${loser.name} missing Slack user/team ID in combat results`,
      );
    }

    const shouldRespawn =
      attackOrigin === AttackOrigin.TEXT_PVE ||
      attackOrigin === AttackOrigin.DROPDOWN_PVP;
    const loserPlayer = await prisma.player.findFirst({
      where: {
        id: loser.id,
      },
      include: {
        slackUser: true,
      },
    });

    const slackUserId = loserPlayer?.slackUser?.userId;
    const slackTeamId = loserPlayer?.slackUser?.teamId;
    if (!slackUserId || !slackTeamId) {
      throw new Error(
        `Missing Slack user/team ID for player ${loser.name} during respawn`,
      );
    }
    if (shouldRespawn) {
      logger.log(`🏥 Respawning defeated player ${loser.name}`);

      const respawnedPlayer = await playerService.respawnPlayer(
        slackTeamId,
        slackUserId,
      );
      loser.hp = respawnedPlayer.hp;
      loser.maxHp = respawnedPlayer.maxHp;
      loser.isAlive = respawnedPlayer.isAlive;
      loser.x = respawnedPlayer.x;
      loser.y = respawnedPlayer.y;
    } else {
      logger.log(`🩹 Restoring defeated player ${loser.name} to full health`);
      const healedLoser = await playerService.restorePlayerHealth(
        slackTeamId,
        slackUserId,
      );
      loser.hp = healedLoser.hp;
      loser.maxHp = healedLoser.maxHp;
      loser.isAlive = healedLoser.isAlive;
      loser.x = healedLoser.x;
      loser.y = healedLoser.y;
    }
  } else {
    logger.debug(`Updating loser ${loser.name} HP to ${loser.hp}...`);
    if (!loser.isAlive) {
      const monster = await prisma.monster.delete({
        where: { id: loser.id },
      });
      await EventBus.emit({
        eventType: 'monster:death',
        monster,
        killedBy: {
          type: winner.type,
          id: winner.id,
        },
        x: monster.x,
        y: monster.y,
        timestamp: new Date(),
      });
      logger.log(`🗑️ Removed defeated monster ${loser.name} from the world`);
    } else {
      const monsterEntity = await prisma.monster.findUnique({
        where: { id: loser.id },
      });
      if (monsterEntity) {
        monsterEntity.hp = loser.hp;
        monsterEntity.isAlive = loser.isAlive;
        await prisma.monster.update({
          where: { id: monsterEntity.id },
          data: monsterEntity,
        });
        logger.debug(
          `Monster ${loser.name} updated: HP=${loser.hp}, alive=${loser.isAlive}`,
        );
      }
    }
  }

  if (winner.type === 'player') {
    const winnerPlayer = await prisma.player.findFirst({
      where: {
        id: winner.id,
      },
      include: {
        slackUser: true,
      },
    });
    if (!winnerPlayer?.slackUser?.userId || !winnerPlayer?.slackUser?.teamId) {
      throw new Error(
        `Missing Slack user/team ID for player ${winner.name} in combat results`,
      );
    }
    const slackUserId = winnerPlayer.slackUser.userId;
    const slackTeamId = winnerPlayer.slackUser.teamId;

    logger.debug(
      `Awarding ${combatLog.xpAwarded} XP to winner ${winner.name}...`,
    );
    const currentPlayer = await playerService.getPlayer(
      slackTeamId,
      slackUserId,
      { requireCreationComplete: true },
    );
    const newXp = currentPlayer.xp + combatLog.xpAwarded;
    const goldAwarded = Math.max(0, combatLog.goldAwarded ?? 0);
    const updatedStats: Partial<{ xp: number; gold: number }> = {
      xp: newXp,
    };
    let newGoldTotal = currentPlayer.gold;
    if (goldAwarded > 0) {
      newGoldTotal += goldAwarded;
      updatedStats.gold = newGoldTotal;
    }
    const updatedPlayer = await playerService.updatePlayerStats(
      slackTeamId,
      slackUserId,
      updatedStats,
    );
    logger.log(
      `📈 ${winner.name} gained ${combatLog.xpAwarded} XP! Total XP: ${currentPlayer.xp} -> ${newXp}`,
    );
    if (goldAwarded > 0)
      logger.log(
        `💰 ${winner.name} gained ${goldAwarded} gold! Total Gold: ${currentPlayer.gold} -> ${newGoldTotal}`,
      );

    if (updatedPlayer.level > currentPlayer.level) {
      const skillPointsAwarded = Math.max(
        0,
        updatedPlayer.skillPoints - currentPlayer.skillPoints,
      );
      winner.level = updatedPlayer.level;
      winner.maxHp = updatedPlayer.maxHp;
      winner.hp = updatedPlayer.hp;
      winner.levelUp = {
        previousLevel: currentPlayer.level,
        newLevel: updatedPlayer.level,
        skillPointsAwarded,
      };
    }

    const healedWinner = await playerService.restorePlayerHealth(
      slackTeamId,
      slackUserId,
    );
    winner.level = healedWinner.level;
    winner.maxHp = healedWinner.maxHp;
    winner.hp = healedWinner.hp;
    winner.isAlive = healedWinner.isAlive;
    winner.x = healedWinner.x;
    winner.y = healedWinner.y;
  } else {
    logger.debug(`Winner ${winner.name} is a monster, no XP or gold awarded`);
  }

  // Log to database for history
  const totalDamage = combatLog.rounds.reduce(
    (total, round) => total + round.damage,
    0,
  );
  logger.debug(
    `Logging combat to database: attacker=${winner.id}, defender=${loser.id}, damage=${totalDamage}`,
  );
  await prisma.combatLog.create({
    data: {
      attackerId: winner.id,
      attackerType: winner.type,
      defenderId: loser.id,
      defenderType: loser.type,
      damage: totalDamage,
      x: combatLog.location.x,
      y: combatLog.location.y,
    },
  });

  logger.log(`💾 Combat results applied and logged to database`);

  return { playerRespawnEvents };
}
