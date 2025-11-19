export type CreatePlayerDto = {
  userId?: string;
  teamId?: string;
  name: string;
  x?: number;
  y?: number;
};

export type MovePlayerDto = {
  direction?: string;
  distance?: number;
  x?: number;
  y?: number;
};

export type PlayerStatsDto = {
  hp?: number;
  xp?: number;
  gold?: number;
  level?: number;
  completeCreation?: boolean;
};

export type AttackDto = {
  targetType: 'player' | 'monster';
  targetId: number;
};
