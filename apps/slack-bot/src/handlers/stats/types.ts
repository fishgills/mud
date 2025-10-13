export interface PlayerStatsSource {
  id?: number;
  slackId?: string;
  name?: string;
  x?: number;
  y?: number;
  hp?: number;
  maxHp?: number;
  strength?: number;
  agility?: number;
  health?: number;
  gold?: number;
  xp?: number;
  level?: number;
  skillPoints?: number;
  isAlive?: boolean;
}

export interface MonsterStatsSource {
  id?: number;
  name?: string;
  type?: string;
  hp?: number;
  maxHp?: number;
  x?: number;
  y?: number;
  isAlive?: boolean;
}
