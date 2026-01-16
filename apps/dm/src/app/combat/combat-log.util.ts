import type { Prisma } from '@mud/database';
import type { DetailedCombatLog } from '../api';

export const serializeCombatLog = (
  combatLog: DetailedCombatLog,
): Prisma.InputJsonValue => JSON.parse(JSON.stringify(combatLog));

export const normalizeCombatLog = (
  combatLog: DetailedCombatLog,
): DetailedCombatLog => {
  if (combatLog.timestamp instanceof Date) {
    return combatLog;
  }
  return {
    ...combatLog,
    timestamp: new Date(combatLog.timestamp),
  };
};
