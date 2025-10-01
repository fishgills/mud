export interface CreatePlayerDto {
  slackId: string;
  name: string;
  x?: number;
  y?: number;
}

export interface MovePlayerDto {
  direction?: string;
  x?: number;
  y?: number;
}

export interface PlayerStatsDto {
  hp?: number;
  xp?: number;
  gold?: number;
  level?: number;
  skillPoints?: number;
  maxHp?: number;
  strength?: number;
  agility?: number;
  health?: number;
}

export interface AttackDto {
  targetType: 'player' | 'monster';
  targetId: number;
}
