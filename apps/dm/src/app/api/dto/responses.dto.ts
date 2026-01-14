import type { CombatLog } from './combat-log.dto';
import type { AttackOrigin } from './player-requests.dto';
import { Monster, Player } from '@mud/database';

export interface EquipmentTotalsDto {
  attackBonus: number;
  damageBonus: number;
  armorBonus: number;
  vitalityBonus: number;
}

export type PlayerWithEquipmentTotals = Player & {
  equipmentTotals?: EquipmentTotalsDto;
  xpToNextLevel?: number;
};

export interface SuccessResponse {
  success: boolean;
  message?: string;
  code?: string;
}

export interface PlayerResponse extends SuccessResponse {
  data?: PlayerWithEquipmentTotals;
}

export interface MonsterResponse extends SuccessResponse {
  data?: Monster;
}

export interface CombatRound {
  roundNumber: number;
  attackerName: string;
  defenderName: string;
  attackRoll: number;
  attackModifier: number;
  totalAttack: number;
  defenderAC: number;
  hit: boolean;
  damage: number;
  defenderHpAfter: number;
  killed: boolean;
  // Bonus breakdown for transparency
  baseAttackModifier?: number;
  attackBonus?: number;
  baseDefenderAC?: number;
  armorBonus?: number;
  baseDamage?: number;
  damageBonus?: number;
}

export interface InitiativeRoll {
  name: string;
  roll: number;
  modifier: number;
  total: number;
}

export interface DetailedCombatLog {
  combatId: string;
  participant1: string;
  participant2: string;
  initiativeRolls: InitiativeRoll[];
  firstAttacker: string;
  rounds: CombatRound[];
  winner: string;
  loser: string;
  xpAwarded: number;
  goldAwarded: number;
  timestamp: Date;
}

export interface CombatPlayerMessage {
  teamId: string;
  userId: string;
  name: string;
  message: string;
  role: string;
  blocks?: Array<Record<string, unknown>>;
}

export interface CombatMessagePerformance {
  totalMs: number;
  attackerMessageMs?: number;
  defenderMessageMs?: number;
}

export interface CombatPerformanceBreakdown {
  totalMs: number;
  loadCombatantsMs: number;
  validationMs: number;
  runCombatMs: number;
  applyResultsMs: number;
  messagePrepMs: number;
  notificationMs: number;
  messageDetails?: CombatMessagePerformance;
}

export interface CombatResult {
  success: boolean;
  winnerName: string;
  loserName: string;
  totalDamageDealt: number;
  roundsCompleted: number;
  xpGained: number;
  goldGained: number;
  message: string;
  playerMessages: CombatPlayerMessage[];
  perfBreakdown?: CombatPerformanceBreakdown;
}

export interface AttackPerformanceStats {
  totalMs: number;
  preCombatMs: number;
  combatMs: number;
  targetResolutionMs?: number;
  combatBreakdown?: CombatPerformanceBreakdown;
  attackOrigin?: AttackOrigin;
}

export interface CombatResponse extends SuccessResponse {
  data?: CombatResult;
  perf?: AttackPerformanceStats;
}

export interface HealthCheck {
  status: string;
  timestamp: string;
}

export interface PlayerStats {
  player: Player;
  strengthModifier: number;
  agilityModifier: number;
  healthModifier: number;
  dodgeChance: number;
  baseDamage: string;
  armorClass: number;
  xpForNextLevel: number;
  xpProgress: number;
  xpNeeded: number;
  recentCombat: CombatLog[];
}
