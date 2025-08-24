import type { RequestInit } from 'node-fetch';
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

export type BiomeSectorSummary = {
  biomeName: Scalars['String']['output'];
  predominantDirections: Array<Scalars['String']['output']>;
  proportion: Scalars['Float']['output'];
};

export type CombatLog = {
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
  data?: Maybe<CombatResult>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type CombatResult = {
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

export type CurrentSettlementInfo = {
  intensity: Scalars['Float']['output'];
  isCenter: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  size: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

/** Cardinal directions for player movement */
export enum Direction {
  EAST = 'EAST',
  NORTH = 'NORTH',
  SOUTH = 'SOUTH',
  WEST = 'WEST'
}

export type GameState = {
  currentTime: Scalars['String']['output'];
  totalMonsters: Scalars['Float']['output'];
  totalPlayers: Scalars['Float']['output'];
};

export type GameStateResponse = {
  data?: Maybe<GameState>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type HealthCheck = {
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type LocationInfo = {
  location: TileInfo;
  monsters?: Maybe<Array<Monster>>;
  players?: Maybe<Array<Player>>;
  recentCombat?: Maybe<Array<CombatLog>>;
};

export type LocationResponse = {
  data?: Maybe<LocationInfo>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type LookViewData = {
  biomeSummary: Array<BiomeSectorSummary>;
  currentSettlement?: Maybe<CurrentSettlementInfo>;
  description: Scalars['String']['output'];
  inSettlement: Scalars['Boolean']['output'];
  location: TileInfo;
  visibilityRadius: Scalars['Float']['output'];
  visiblePeaks: Array<VisiblePeakInfo>;
  visibleSettlements: Array<VisibleSettlementInfo>;
};

export type LookViewResponse = {
  data?: Maybe<LookViewData>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type Monster = {
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
  data?: Maybe<Monster>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type MovePlayerInput = {
  direction: Direction;
};

export type Mutation = {
  attack: CombatResponse;
  createPlayer: PlayerResponse;
  damagePlayer: PlayerResponse;
  deletePlayer: PlayerResponse;
  healPlayer: PlayerResponse;
  movePlayer: PlayerMoveResponse;
  processTick: SuccessResponse;
  rerollPlayerStats: PlayerResponse;
  respawn: PlayerResponse;
  spawnMonster: MonsterResponse;
  updatePlayerStats: PlayerResponse;
};


export type MutationattackArgs = {
  input: AttackInput;
  slackId: Scalars['String']['input'];
};


export type MutationcreatePlayerArgs = {
  input: CreatePlayerInput;
};


export type MutationdamagePlayerArgs = {
  damage: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
};


export type MutationdeletePlayerArgs = {
  slackId: Scalars['String']['input'];
};


export type MutationhealPlayerArgs = {
  amount: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
};


export type MutationmovePlayerArgs = {
  input: MovePlayerInput;
  slackId: Scalars['String']['input'];
};


export type MutationrerollPlayerStatsArgs = {
  slackId: Scalars['String']['input'];
};


export type MutationrespawnArgs = {
  slackId: Scalars['String']['input'];
};


export type MutationspawnMonsterArgs = {
  input: SpawnMonsterInput;
};


export type MutationupdatePlayerStatsArgs = {
  input: PlayerStatsInput;
  slackId: Scalars['String']['input'];
};

export type NearbyPlayerInfo = {
  direction: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type Player = {
  agility: Scalars['Int']['output'];
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  currentTile?: Maybe<TileInfo>;
  gold: Scalars['Int']['output'];
  health: Scalars['Int']['output'];
  hp: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isAlive: Scalars['Boolean']['output'];
  lastAction?: Maybe<Scalars['DateTime']['output']>;
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
  data?: Maybe<PlayerMovementData>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type PlayerMovementData = {
  currentSettlement?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  location: TileInfo;
  monsters: Array<Monster>;
  nearbyBiomes?: Maybe<Array<Scalars['String']['output']>>;
  nearbyPlayers?: Maybe<Array<NearbyPlayerInfo>>;
  nearbySettlements?: Maybe<Array<Scalars['String']['output']>>;
  player: Player;
  playerInfo: Scalars['String']['output'];
  surroundingTiles: Array<SurroundingTile>;
};

export type PlayerResponse = {
  data?: Maybe<Player>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type PlayerStats = {
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
  getAllMonsters: Array<Monster>;
  getAllPlayers: Array<Player>;
  getGameState: GameStateResponse;
  getLocationInfo: LocationResponse;
  getLookView: LookViewResponse;
  getMovementView: PlayerMoveResponse;
  getPlayer: PlayerResponse;
  getPlayerStats: PlayerStats;
  getPlayersAtLocation: Array<Player>;
  health: HealthCheck;
};


export type QuerygetLocationInfoArgs = {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
};


export type QuerygetLookViewArgs = {
  slackId: Scalars['String']['input'];
};


export type QuerygetMovementViewArgs = {
  slackId: Scalars['String']['input'];
};


export type QuerygetPlayerArgs = {
  slackId: Scalars['String']['input'];
};


export type QuerygetPlayerStatsArgs = {
  slackId: Scalars['String']['input'];
};


export type QuerygetPlayersAtLocationArgs = {
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
};

export type SpawnMonsterInput = {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
};

export type SuccessResponse = {
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type SurroundingTile = {
  biomeName: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  direction: Scalars['String']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export enum TargetType {
  MONSTER = 'MONSTER',
  PLAYER = 'PLAYER'
}

export type TileInfo = {
  biomeName: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  height: Scalars['Float']['output'];
  moisture: Scalars['Float']['output'];
  temperature: Scalars['Float']['output'];
  x: Scalars['Float']['output'];
  y: Scalars['Float']['output'];
};

export type VisiblePeakInfo = {
  direction: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
  height: Scalars['Float']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type VisibleSettlementInfo = {
  direction: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  size: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type MovePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
  input: MovePlayerInput;
}>;


export type MovePlayerMutation = { movePlayer: { success: boolean, message?: string | null, data?: { playerInfo: string, description: string, player: { id: string, name: string, x: number, y: number, hp: number, isAlive: boolean }, location: { x: number, y: number, temperature: number, moisture: number, biomeName: string, description?: string | null }, surroundingTiles: Array<{ x: number, y: number, biomeName: string, description?: string | null, direction: string }>, monsters: Array<{ id: string, name: string, hp: number, isAlive: boolean }> } | null } };

export type AttackMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
  input: AttackInput;
}>;


export type AttackMutation = { attack: { success: boolean, message?: string | null, data?: { attackerName: string, defenderName: string, damage: number, defenderHp: number, defenderMaxHp: number, isDead: boolean, message: string, xpGained?: number | null } | null } };

export type GetPlayerQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type GetPlayerQuery = { getPlayer: { success: boolean, message?: string | null, data?: { id: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, isAlive: boolean, nearbyMonsters?: Array<{ id: string, name: string, hp: number, isAlive: boolean }> | null } | null } };

export type GetLocationInfoQueryVariables = Exact<{
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}>;


export type GetLocationInfoQuery = { getLocationInfo: { success: boolean, message?: string | null, data?: { location: { x: number, y: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number }, monsters?: Array<{ id: string, name: string, hp: number, isAlive: boolean }> | null, players?: Array<{ id: string, name: string, hp: number, isAlive: boolean }> | null, recentCombat?: Array<{ id: string, attackerId: number, attackerType: string, defenderId: number, defenderType: string, damage: number, timestamp: any }> | null } | null } };

export type GetPlayerWithLocationQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type GetPlayerWithLocationQuery = { getPlayer: { success: boolean, message?: string | null, data?: { id: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, isAlive: boolean, nearbyMonsters?: Array<{ id: string, name: string, hp: number, isAlive: boolean }> | null, currentTile?: { x: number, y: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number } | null, nearbyPlayers?: Array<{ id: string, name: string, hp: number, isAlive: boolean }> | null } | null } };

export type GetMovementViewQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type GetMovementViewQuery = { getMovementView: { success: boolean, message?: string | null, data?: { playerInfo: string, description: string, player: { id: string, name: string, x: number, y: number, hp: number, isAlive: boolean }, location: { x: number, y: number, biomeName: string, description?: string | null }, surroundingTiles: Array<{ x: number, y: number, biomeName: string, description?: string | null, direction: string }>, monsters: Array<{ id: string, name: string, hp: number, isAlive: boolean }> } | null } };

export type GetLookViewQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type GetLookViewQuery = { getLookView: { success: boolean, message?: string | null, data?: { visibilityRadius: number, description: string, location: { x: number, y: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number }, currentSettlement?: { name: string, type: string, size: string, intensity: number, isCenter: boolean } | null, biomeSummary: Array<{ biomeName: string, proportion: number, predominantDirections: Array<string> }>, visiblePeaks: Array<{ x: number, y: number, height: number, distance: number, direction: string }>, visibleSettlements: Array<{ name: string, type: string, size: string, distance: number, direction: string }> } | null } };

export type CreatePlayerMutationVariables = Exact<{
  input: CreatePlayerInput;
}>;


export type CreatePlayerMutation = { createPlayer: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, isAlive: boolean, updatedAt: any } | null } };

export type RerollPlayerStatsMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type RerollPlayerStatsMutation = { rerollPlayerStats: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string, strength: number, agility: number, health: number, maxHp: number } | null } };

export type CompletePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type CompletePlayerMutation = { updatePlayerStats: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string, isAlive: boolean } | null } };

export type DeletePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type DeletePlayerMutation = { deletePlayer: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string } | null } };


export const MovePlayerDocument = gql`
    mutation MovePlayer($slackId: String!, $input: MovePlayerInput!) {
  movePlayer(slackId: $slackId, input: $input) {
    success
    message
    data {
      player {
        id
        name
        x
        y
        hp
        isAlive
      }
      location {
        x
        y
        temperature
        moisture
        biomeName
        description
      }
      surroundingTiles {
        x
        y
        biomeName
        description
        direction
      }
      monsters {
        id
        name
        hp
        isAlive
      }
      playerInfo
      description
    }
  }
}
    `;
export const AttackDocument = gql`
    mutation Attack($slackId: String!, $input: AttackInput!) {
  attack(slackId: $slackId, input: $input) {
    success
    message
    data {
      attackerName
      defenderName
      damage
      defenderHp
      defenderMaxHp
      isDead
      message
      xpGained
    }
  }
}
    `;
export const GetPlayerDocument = gql`
    query GetPlayer($slackId: String!) {
  getPlayer(slackId: $slackId) {
    success
    message
    data {
      id
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
      nearbyMonsters {
        id
        name
        hp
        isAlive
      }
    }
  }
}
    `;
export const GetLocationInfoDocument = gql`
    query GetLocationInfo($x: Int!, $y: Int!) {
  getLocationInfo(x: $x, y: $y) {
    success
    message
    data {
      location {
        x
        y
        biomeName
        description
        height
        temperature
        moisture
      }
      monsters {
        id
        name
        hp
        isAlive
      }
      players {
        id
        name
        hp
        isAlive
      }
      recentCombat {
        id
        attackerId
        attackerType
        defenderId
        defenderType
        damage
        timestamp
      }
    }
  }
}
    `;
export const GetPlayerWithLocationDocument = gql`
    query GetPlayerWithLocation($slackId: String!) {
  getPlayer(slackId: $slackId) {
    success
    message
    data {
      id
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
      nearbyMonsters {
        id
        name
        hp
        isAlive
      }
      currentTile {
        x
        y
        biomeName
        description
        height
        temperature
        moisture
      }
      nearbyPlayers {
        id
        name
        hp
        isAlive
      }
    }
  }
}
    `;
export const GetMovementViewDocument = gql`
    query GetMovementView($slackId: String!) {
  getMovementView(slackId: $slackId) {
    success
    message
    data {
      player {
        id
        name
        x
        y
        hp
        isAlive
      }
      location {
        x
        y
        biomeName
        description
      }
      surroundingTiles {
        x
        y
        biomeName
        description
        direction
      }
      monsters {
        id
        name
        hp
        isAlive
      }
      playerInfo
      description
    }
  }
}
    `;
export const GetLookViewDocument = gql`
    query GetLookView($slackId: String!) {
  getLookView(slackId: $slackId) {
    success
    message
    data {
      location {
        x
        y
        biomeName
        description
        height
        temperature
        moisture
      }
      currentSettlement {
        name
        type
        size
        intensity
        isCenter
      }
      visibilityRadius
      biomeSummary {
        biomeName
        proportion
        predominantDirections
      }
      visiblePeaks {
        x
        y
        height
        distance
        direction
      }
      visibleSettlements {
        name
        type
        size
        distance
        direction
      }
      description
    }
  }
}
    `;
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
      updatedAt
    }
  }
}
    `;
export const RerollPlayerStatsDocument = gql`
    mutation RerollPlayerStats($slackId: String!) {
  rerollPlayerStats(slackId: $slackId) {
    success
    message
    data {
      id
      slackId
      name
      strength
      agility
      health
      maxHp
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
export const DeletePlayerDocument = gql`
    mutation DeletePlayer($slackId: String!) {
  deletePlayer(slackId: $slackId) {
    success
    message
    data {
      id
      slackId
      name
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    MovePlayer(variables: MovePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MovePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<MovePlayerMutation>({ document: MovePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MovePlayer', 'mutation', variables);
    },
    Attack(variables: AttackMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<AttackMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<AttackMutation>({ document: AttackDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'Attack', 'mutation', variables);
    },
    GetPlayer(variables: GetPlayerQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPlayerQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPlayerQuery>({ document: GetPlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPlayer', 'query', variables);
    },
    GetLocationInfo(variables: GetLocationInfoQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetLocationInfoQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetLocationInfoQuery>({ document: GetLocationInfoDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetLocationInfo', 'query', variables);
    },
    GetPlayerWithLocation(variables: GetPlayerWithLocationQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPlayerWithLocationQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPlayerWithLocationQuery>({ document: GetPlayerWithLocationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPlayerWithLocation', 'query', variables);
    },
    GetMovementView(variables: GetMovementViewQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMovementViewQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMovementViewQuery>({ document: GetMovementViewDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMovementView', 'query', variables);
    },
    GetLookView(variables: GetLookViewQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetLookViewQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetLookViewQuery>({ document: GetLookViewDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetLookView', 'query', variables);
    },
    CreatePlayer(variables: CreatePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreatePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreatePlayerMutation>({ document: CreatePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreatePlayer', 'mutation', variables);
    },
    RerollPlayerStats(variables: RerollPlayerStatsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RerollPlayerStatsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RerollPlayerStatsMutation>({ document: RerollPlayerStatsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RerollPlayerStats', 'mutation', variables);
    },
    CompletePlayer(variables: CompletePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CompletePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CompletePlayerMutation>({ document: CompletePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CompletePlayer', 'mutation', variables);
    },
    DeletePlayer(variables: DeletePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeletePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeletePlayerMutation>({ document: DeletePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeletePlayer', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;