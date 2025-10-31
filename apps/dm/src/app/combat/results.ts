import { MonsterFactory } from '@mud/engine';
import type { PlayerService } from '../player/player.service';
import type { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import type { DetailedCombatLog } from '../api';
import type { Combatant } from './types';

export async function applyCombatResults(
  combatLog: DetailedCombatLog,
  combatant1: Combatant,
  combatant2: Combatant,
  playerService: PlayerService,
  prisma: PrismaClient,
  logger: Logger,
): Promise<void> {
  logger.debug(`🔄 Applying combat results for combat ${combatLog.combatId}`);

  const winner = combatant1.name === combatLog.winner ? combatant1 : combatant2;
  const loser = combatant1.name === combatLog.loser ? combatant1 : combatant2;

  logger.debug(
    `Winner: ${winner.name} (${winner.type}, ID: ${winner.id}), Loser: ${loser.name} (${loser.type}, ID: ${loser.id})`,
  );

  // Update loser's HP
  logger.debug(`Updating loser ${loser.name} HP to ${loser.hp}...`);
  if (loser.type === 'player') {
    if (!loser.slackId)
      throw new Error(`Player ${loser.name} missing slackId in combat results`);
    await playerService.updatePlayerStats(loser.slackId, { hp: loser.hp });
    if (!loser.isAlive) {
      logger.log(`🏥 Respawning defeated player ${loser.name}`);
      await playerService.respawnPlayer(loser.slackId);
    }
  } else {
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

  // Award XP to winner if they're a player
  if (winner.type === 'player') {
    if (!winner.slackId)
      throw new Error(
        `Player ${winner.name} missing slackId in combat results`,
      );
    logger.debug(
      `Awarding ${combatLog.xpAwarded} XP to winner ${winner.name}...`,
    );
    const currentPlayer = await playerService.getPlayer(winner.slackId);
    const newXp = currentPlayer.xp + combatLog.xpAwarded;
    const goldAwarded = Math.max(0, combatLog.goldAwarded ?? 0);
    const updatedStats: any = { xp: newXp, hp: winner.hp };
    let newGoldTotal = currentPlayer.gold;
    if (goldAwarded > 0) {
      newGoldTotal = currentPlayer.gold + goldAwarded;
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
}
