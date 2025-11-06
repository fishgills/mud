import { MonsterFactory, type PlayerRespawnEvent } from '@mud/engine';
import type { PlayerService } from '../player/player.service';
import type { PrismaClient } from '@prisma/client';
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
    if (!loser.slackId) {
      throw new Error(`Player ${loser.name} missing slackId in combat results`);
    }

    const shouldRespawn =
      attackOrigin === AttackOrigin.TEXT_PVE ||
      attackOrigin === AttackOrigin.DROPDOWN_PVP;

    if (shouldRespawn) {
      logger.log(`🏥 Respawning defeated player ${loser.name}`);
      const { player: respawnedPlayer, event } =
        await playerService.respawnPlayer(loser.slackId, {
          emitEvent: false,
        });
      if (event) {
        playerRespawnEvents.push(event);
      }
      loser.hp = respawnedPlayer.combat.hp;
      loser.maxHp = respawnedPlayer.combat.maxHp;
      loser.isAlive = respawnedPlayer.combat.isAlive;
      loser.x = respawnedPlayer.position.x;
      loser.y = respawnedPlayer.position.y;
    } else {
      logger.log(`🩹 Restoring defeated player ${loser.name} to full health`);
      const healedLoser = await playerService.restorePlayerHealth(
        loser.slackId,
      );
      loser.hp = healedLoser.combat.hp;
      loser.maxHp = healedLoser.combat.maxHp;
      loser.isAlive = healedLoser.combat.isAlive;
      loser.x = healedLoser.position.x;
      loser.y = healedLoser.position.y;
    }
  } else {
    logger.debug(`Updating loser ${loser.name} HP to ${loser.hp}...`);
    if (!loser.isAlive) {
      await MonsterFactory.delete(loser.id, {
        killedBy: { type: winner.type, id: winner.id },
      });
      logger.log(`🗑️ Removed defeated monster ${loser.name} from the world`);
    } else {
      const monsterEntity = await MonsterFactory.load(loser.id);
      if (monsterEntity) {
        monsterEntity.combat.hp = loser.hp;
        monsterEntity.combat.isAlive = loser.isAlive;
        await MonsterFactory.save(monsterEntity);
        logger.debug(
          `Monster ${loser.name} updated: HP=${loser.hp}, alive=${loser.isAlive}`,
        );
      }
    }
  }

  if (winner.type === 'player') {
    if (!winner.slackId) {
      throw new Error(
        `Player ${winner.name} missing slackId in combat results`,
      );
    }
    logger.debug(
      `Awarding ${combatLog.xpAwarded} XP to winner ${winner.name}...`,
    );
    const currentPlayer = await playerService.getPlayer(winner.slackId);
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
      winner.slackId,
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
      winner.maxHp = updatedPlayer.combat.maxHp;
      winner.hp = updatedPlayer.combat.hp;
      winner.levelUp = {
        previousLevel: currentPlayer.level,
        newLevel: updatedPlayer.level,
        skillPointsAwarded,
      };
    }

    const healedWinner = await playerService.restorePlayerHealth(
      winner.slackId,
    );
    winner.level = healedWinner.level;
    winner.maxHp = healedWinner.combat.maxHp;
    winner.hp = healedWinner.combat.hp;
    winner.isAlive = healedWinner.combat.isAlive;
    winner.x = healedWinner.position.x;
    winner.y = healedWinner.position.y;
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
