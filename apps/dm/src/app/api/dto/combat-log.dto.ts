export interface CombatLog {
  id: number;
  combatId?: string | null;
  attackerId: number;
  attackerType: string;
  defenderId: number;
  defenderType: string;
  damage: number;
  log?: unknown;
  runId?: number | null;
  runRound?: number | null;
  timestamp: Date;
}
