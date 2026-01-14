export enum TargetType {
  PLAYER = 'player',
  MONSTER = 'monster',
}

export enum AttackOrigin {
  TEXT_PVE = 'text-pve',
  TEXT_PVP = 'text-pvp',
  DROPDOWN_PVP = 'dropdown-pvp',
}

export enum PlayerAttribute {
  STRENGTH = 'strength',
  AGILITY = 'agility',
  HEALTH = 'health',
}

export enum ClientType {
  SLACK = 'slack',
  DISCORD = 'discord',
  WEB = 'web',
}

export interface CreatePlayerRequest {
  teamId?: string;
  userId?: string;
  clientType?: ClientType;
  name: string;
}

export interface PlayerStatsRequest {
  hp?: number;
  xp?: number;
  gold?: number;
  level?: number;
}

export interface AttackRequest {
  targetType: TargetType;
  targetId?: number;
  targetUserId?: string;
  targetTeamId?: string;
  attackOrigin?: AttackOrigin;
}

export interface SpawnMonsterRequest {
  type?: string;
}
