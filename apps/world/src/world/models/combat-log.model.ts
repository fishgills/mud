export interface CombatLog {
  id: number;
  attackerId: number;
  attackerType: string;
  defenderId: number;
  defenderType: string;
  damage: number;
  x: number;
  y: number;
  timestamp: Date;
}
