export enum TargetType {
  PLAYER = 'player',
  MONSTER = 'monster',
}

export enum AttackOrigin {
  TEXT_PVE = 'text-pve',
  TEXT_PVP = 'text-pvp',
  DROPDOWN_PVP = 'dropdown-pvp',
}

export enum Direction {
  NORTH = 'n',
  EAST = 'e',
  SOUTH = 's',
  WEST = 'w',
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
  slackId?: string;
  clientId?: string;
  clientType?: ClientType;
  name: string;
  x?: number;
  y?: number;
}

export interface MovePlayerRequest {
  direction?: Direction;
  distance?: number;
  x?: number;
  y?: number;
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
  targetSlackId?: string;
  ignoreLocation?: boolean;
  attackOrigin?: AttackOrigin;
}

export interface SpawnMonsterRequest {
  x: number;
  y: number;
}
