export type CreatePlayerDto = {
  userId?: string;
  teamId?: string;
  name: string;
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
