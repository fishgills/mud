export interface CreatePlayerDto {
  userId?: string;
  teamId?: string;
  name: string;
  x?: number;
  y?: number;
}

export interface MovePlayerDto {
  direction?: string;
  distance?: number;
  x?: number;
  y?: number;
}

export interface PlayerStatsDto {
  hp?: number;
  xp?: number;
  gold?: number;
  level?: number;
  completeCreation?: boolean;
}

export interface AttackDto {
  targetType: 'player' | 'monster';
  targetId: number;
}
