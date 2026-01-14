import type { CombatRound, DetailedCombatLog } from '../api';
import type { ItemQualityType } from '@mud/database';

export type CombatantEquipment = {
  name: string;
  slot?: string | null;
  quality?: ItemQualityType | null;
};

export interface CombatNarrative {
  metrics: string;
  rounds: string[];
}

export interface NarrativeOptions {
  secondPersonName?: string;
  attackerCombatant?: Combatant;
  defenderCombatant?: Combatant;
}

export interface CombatMessage {
  teamId: string;
  userId: string;
  name: string;
  message: string;
  role: 'attacker' | 'defender' | 'observer';
  blocks?: Array<Record<string, unknown>>;
}

export interface Combatant {
  id: number;
  name: string;
  type: 'player' | 'monster';
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  level: number;
  isAlive: boolean;
  slackUser?: {
    teamId: string;
    userId: string;
  };
  levelUp?: {
    previousLevel: number;
    newLevel: number;
    skillPointsAwarded: number;
  };
  attackBonus?: number;
  damageBonus?: number;
  damageRoll?: string;
  armorBonus?: number;
  equippedItems?: CombatantEquipment[];
}

export type { CombatRound, DetailedCombatLog };
