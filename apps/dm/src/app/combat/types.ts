import type { CombatRound, DetailedCombatLog } from '../api';

export interface CombatNarrative {
  summary: string;
  rounds: string[];
}

export interface NarrativeOptions {
  secondPersonName?: string;
}

export interface CombatMessage {
  slackId: string;
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
  x: number;
  y: number;
  slackId?: string;
  levelUp?: {
    previousLevel: number;
    newLevel: number;
    skillPointsAwarded: number;
  };
}

export type { CombatRound, DetailedCombatLog };
