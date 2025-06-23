import { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
};

export type AttackInput = {
  targetId: Scalars['Int']['input'];
  targetType: TargetType;
};

export type CombatLog = {
  __typename?: 'CombatLog';
  attackerId: Scalars['Int']['output'];
  attackerType: Scalars['String']['output'];
  damage: Scalars['Int']['output'];
  defenderId: Scalars['Int']['output'];
  defenderType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type CombatResponse = {
  __typename?: 'CombatResponse';
  data?: Maybe<CombatResult>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type CombatResult = {
  __typename?: 'CombatResult';
  attackerName: Scalars['String']['output'];
  damage: Scalars['Float']['output'];
  defenderHp: Scalars['Float']['output'];
  defenderMaxHp: Scalars['Float']['output'];
  defenderName: Scalars['String']['output'];
  isDead: Scalars['Boolean']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  xpGained?: Maybe<Scalars['Float']['output']>;
};

export type CreatePlayerInput = {
  name: Scalars['String']['input'];
  slackId: Scalars['String']['input'];
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
};

/** Cardinal directions for player movement */
export enum Direction {
  East = 'EAST',
  North = 'NORTH',
  South = 'SOUTH',
  West = 'WEST'
}

export type GameState = {
  __typename?: 'GameState';
  currentTime: Scalars['String']['output'];
  totalMonsters: Scalars['Float']['output'];
  totalPlayers: Scalars['Float']['output'];
};

export type GameStateResponse = {
  __typename?: 'GameStateResponse';
  data?: Maybe<GameState>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type HealthCheck = {
  __typename?: 'HealthCheck';
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type LocationInfo = {
  __typename?: 'LocationInfo';
  location: TileInfo;
  monsters?: Maybe<Array<Monster>>;
  players?: Maybe<Array<Player>>;
  recentCombat?: Maybe<Array<CombatLog>>;
};

export type LocationResponse = {
  __typename?: 'LocationResponse';
  data?: Maybe<LocationInfo>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type Monster = {
  __typename?: 'Monster';
  agility: Scalars['Int']['output'];
  biomeId: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  health: Scalars['Int']['output'];
  hp: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isAlive: Scalars['Boolean']['output'];
  lastMove: Scalars['DateTime']['output'];
  maxHp: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  spawnedAt: Scalars['DateTime']['output'];
  strength: Scalars['Int']['output'];
  type: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  worldTileId?: Maybe<Scalars['Int']['output']>;
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type MonsterResponse = {
  __typename?: 'MonsterResponse';
  data?: Maybe<Monster>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type MovePlayerInput = {
  direction: Direction;
};

export type Mutation = {
  __typename?: 'Mutation';
  attack: CombatResponse;
  createPlayer: PlayerResponse;
  damagePlayer: PlayerResponse;
  healPlayer: PlayerResponse;
  movePlayer: PlayerMoveResponse;
  processTick: SuccessResponse;
  respawn: PlayerResponse;
  spawnMonster: MonsterResponse;
  updatePlayerStats: PlayerResponse;
};


export type MutationAttackArgs = {
  input: AttackInput;
  slackId: Scalars['String']['input'];
};


export type MutationCreatePlayerArgs = {
  input: CreatePlayerInput;
};


export type MutationDamagePlayerArgs = {
  damage: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
};


export type MutationHealPlayerArgs = {
  amount: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
};


export type MutationMovePlayerArgs = {
  input: MovePlayerInput;
  slackId: Scalars['String']['input'];
};


export type MutationRespawnArgs = {
  slackId: Scalars['String']['input'];
};


export type MutationSpawnMonsterArgs = {
  input: SpawnMonsterInput;
};


export type MutationUpdatePlayerStatsArgs = {
  input: PlayerStatsInput;
  slackId: Scalars['String']['input'];
};

export type Player = {
  __typename?: 'Player';
  agility: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  currentTile?: Maybe<TileInfo>;
  gold: Scalars['Int']['output'];
  health: Scalars['Int']['output'];
  hp: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isAlive: Scalars['Boolean']['output'];
  lastAction: Scalars['DateTime']['output'];
  level: Scalars['Int']['output'];
  maxHp: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  nearbyMonsters?: Maybe<Array<Monster>>;
  nearbyPlayers?: Maybe<Array<Player>>;
  slackId: Scalars['String']['output'];
  strength: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  worldTileId?: Maybe<Scalars['Int']['output']>;
  x: Scalars['Int']['output'];
  xp: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type PlayerMoveResponse = {
  __typename?: 'PlayerMoveResponse';
  data?: Maybe<PlayerMovementData>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type PlayerMovementData = {
  __typename?: 'PlayerMovementData';
  currentSettlement?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  location: TileInfo;
  monsters: Array<Monster>;
  nearbyBiomes?: Maybe<Array<Scalars['String']['output']>>;
  nearbySettlements?: Maybe<Array<Scalars['String']['output']>>;
  player: Player;
  playerInfo: Scalars['String']['output'];
  surroundingTiles: Array<SurroundingTile>;
};

export type PlayerResponse = {
  __typename?: 'PlayerResponse';
  data?: Maybe<Player>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type PlayerStats = {
  __typename?: 'PlayerStats';
  agilityModifier: Scalars['Float']['output'];
  armorClass: Scalars['Float']['output'];
  baseDamage: Scalars['String']['output'];
  dodgeChance: Scalars['Float']['output'];
  healthModifier: Scalars['Float']['output'];
  player: Player;
  recentCombat: Array<CombatLog>;
  strengthModifier: Scalars['Float']['output'];
  xpForNextLevel: Scalars['Float']['output'];
  xpNeeded: Scalars['Float']['output'];
  xpProgress: Scalars['Float']['output'];
};

export type PlayerStatsInput = {
  gold?: InputMaybe<Scalars['Int']['input']>;
  hp?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  xp?: InputMaybe<Scalars['Int']['input']>;
};

export type Query = {
  __typename?: 'Query';
  getAllMonsters: Array<Monster>;
  getAllPlayers: Array<Player>;
  getGameState: GameStateResponse;
  getLocationInfo: LocationResponse;
  getPlayer: PlayerResponse;
  getPlayerStats: PlayerStats;
  getPlayersAtLocation: Array<Player>;
  health: HealthCheck;
};


export type QueryGetLocationInfoArgs = {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
};


export type QueryGetPlayerArgs = {
  slackId: Scalars['String']['input'];
};


export type QueryGetPlayerStatsArgs = {
  slackId: Scalars['String']['input'];
};


export type QueryGetPlayersAtLocationArgs = {
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
};

export type SpawnMonsterInput = {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
};

export type SuccessResponse = {
  __typename?: 'SuccessResponse';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type SurroundingTile = {
  __typename?: 'SurroundingTile';
  biomeName: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  direction: Scalars['String']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export enum TargetType {
  Monster = 'MONSTER',
  Player = 'PLAYER'
}

export type TileInfo = {
  __typename?: 'TileInfo';
  biomeName: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  height: Scalars['Float']['output'];
  moisture: Scalars['Float']['output'];
  temperature: Scalars['Float']['output'];
  x: Scalars['Float']['output'];
  y: Scalars['Float']['output'];
};

export type CreatePlayerMutationVariables = Exact<{
  input: CreatePlayerInput;
}>;


export type CreatePlayerMutation = { __typename?: 'Mutation', createPlayer: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, isAlive: boolean } | null } };

export type RerollPlayerStatsMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type RerollPlayerStatsMutation = { __typename?: 'Mutation', updatePlayerStats: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string, strength: number, agility: number, health: number } | null } };

export type CompletePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type CompletePlayerMutation = { __typename?: 'Mutation', updatePlayerStats: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string, isAlive: boolean } | null } };


export const CreatePlayerDocument = gql`
    mutation CreatePlayer($input: CreatePlayerInput!) {
  createPlayer(input: $input) {
    success
    message
    data {
      id
      slackId
      name
      x
      y
      hp
      maxHp
      strength
      agility
      health
      gold
      xp
      level
      isAlive
    }
  }
}
    `;
export const RerollPlayerStatsDocument = gql`
    mutation RerollPlayerStats($slackId: String!) {
  updatePlayerStats(slackId: $slackId, input: {}) {
    success
    message
    data {
      id
      slackId
      name
      strength
      agility
      health
    }
  }
}
    `;
export const CompletePlayerDocument = gql`
    mutation CompletePlayer($slackId: String!) {
  updatePlayerStats(slackId: $slackId, input: {hp: 10}) {
    success
    message
    data {
      id
      slackId
      name
      isAlive
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    CreatePlayer(variables: CreatePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreatePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreatePlayerMutation>({ document: CreatePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreatePlayer', 'mutation', variables);
    },
    RerollPlayerStats(variables: RerollPlayerStatsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RerollPlayerStatsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RerollPlayerStatsMutation>({ document: RerollPlayerStatsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RerollPlayerStats', 'mutation', variables);
    },
    CompletePlayer(variables: CompletePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CompletePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CompletePlayerMutation>({ document: CompletePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CompletePlayer', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;