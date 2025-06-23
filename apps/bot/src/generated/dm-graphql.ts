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
export interface Scalars {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
}

export interface DMTAttackInput {
  targetId: Scalars['Int']['input'];
  targetType: DMTTargetType;
}

export interface DMTCombatLog {
  attackerId: Scalars['Int']['output'];
  attackerType: Scalars['String']['output'];
  damage: Scalars['Int']['output'];
  defenderId: Scalars['Int']['output'];
  defenderType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
}

export interface DMTCombatResponse {
  data?: Maybe<DMTCombatResult>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTCombatResult {
  attackerName: Scalars['String']['output'];
  damage: Scalars['Float']['output'];
  defenderHp: Scalars['Float']['output'];
  defenderMaxHp: Scalars['Float']['output'];
  defenderName: Scalars['String']['output'];
  isDead: Scalars['Boolean']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  xpGained?: Maybe<Scalars['Float']['output']>;
}

export interface DMTCreatePlayerInput {
  name: Scalars['String']['input'];
  slackId: Scalars['String']['input'];
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
}

/** Cardinal directions for player movement */
export enum DMTDirection {
  East = 'EAST',
  North = 'NORTH',
  South = 'SOUTH',
  West = 'WEST'
}

export interface DMTGameState {
  currentTime: Scalars['String']['output'];
  totalMonsters: Scalars['Float']['output'];
  totalPlayers: Scalars['Float']['output'];
}

export interface DMTGameStateResponse {
  data?: Maybe<DMTGameState>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTHealthCheck {
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
}

export interface DMTLocationInfo {
  location: DMTTileInfo;
  monsters?: Maybe<Array<DMTMonster>>;
  players?: Maybe<Array<DMTPlayer>>;
  recentCombat?: Maybe<Array<DMTCombatLog>>;
}

export interface DMTLocationResponse {
  data?: Maybe<DMTLocationInfo>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTMonster {
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
}

export interface DMTMonsterResponse {
  data?: Maybe<DMTMonster>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTMovePlayerInput {
  direction: DMTDirection;
}

export interface DMTMutation {
  attack: DMTCombatResponse;
  createPlayer: DMTPlayerResponse;
  damagePlayer: DMTPlayerResponse;
  healPlayer: DMTPlayerResponse;
  movePlayer: DMTPlayerMoveResponse;
  processTick: DMTSuccessResponse;
  respawn: DMTPlayerResponse;
  spawnMonster: DMTMonsterResponse;
  updatePlayerStats: DMTPlayerResponse;
}


export interface DMTMutationAttackArgs {
  input: DMTAttackInput;
  slackId: Scalars['String']['input'];
}


export interface DMTMutationCreatePlayerArgs {
  input: DMTCreatePlayerInput;
}


export interface DMTMutationDamagePlayerArgs {
  damage: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
}


export interface DMTMutationHealPlayerArgs {
  amount: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
}


export interface DMTMutationMovePlayerArgs {
  input: DMTMovePlayerInput;
  slackId: Scalars['String']['input'];
}


export interface DMTMutationRespawnArgs {
  slackId: Scalars['String']['input'];
}


export interface DMTMutationSpawnMonsterArgs {
  input: DMTSpawnMonsterInput;
}


export interface DMTMutationUpdatePlayerStatsArgs {
  input: DMTPlayerStatsInput;
  slackId: Scalars['String']['input'];
}

export interface DMTPlayer {
  agility: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  currentTile?: Maybe<DMTTileInfo>;
  gold: Scalars['Int']['output'];
  health: Scalars['Int']['output'];
  hp: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isAlive: Scalars['Boolean']['output'];
  lastAction: Scalars['DateTime']['output'];
  level: Scalars['Int']['output'];
  maxHp: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  nearbyMonsters?: Maybe<Array<DMTMonster>>;
  nearbyPlayers?: Maybe<Array<DMTPlayer>>;
  slackId: Scalars['String']['output'];
  strength: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  worldTileId?: Maybe<Scalars['Int']['output']>;
  x: Scalars['Int']['output'];
  xp: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
}

export interface DMTPlayerMoveResponse {
  data?: Maybe<DMTPlayerMovementData>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTPlayerMovementData {
  currentSettlement?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  location: DMTTileInfo;
  monsters: Array<DMTMonster>;
  nearbyBiomes?: Maybe<Array<Scalars['String']['output']>>;
  nearbySettlements?: Maybe<Array<Scalars['String']['output']>>;
  player: DMTPlayer;
  playerInfo: Scalars['String']['output'];
  surroundingTiles: Array<DMTSurroundingTile>;
}

export interface DMTPlayerResponse {
  data?: Maybe<DMTPlayer>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTPlayerStats {
  agilityModifier: Scalars['Float']['output'];
  armorClass: Scalars['Float']['output'];
  baseDamage: Scalars['String']['output'];
  dodgeChance: Scalars['Float']['output'];
  healthModifier: Scalars['Float']['output'];
  player: DMTPlayer;
  recentCombat: Array<DMTCombatLog>;
  strengthModifier: Scalars['Float']['output'];
  xpForNextLevel: Scalars['Float']['output'];
  xpNeeded: Scalars['Float']['output'];
  xpProgress: Scalars['Float']['output'];
}

export interface DMTPlayerStatsInput {
  gold?: InputMaybe<Scalars['Int']['input']>;
  hp?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  xp?: InputMaybe<Scalars['Int']['input']>;
}

export interface DMTQuery {
  getAllMonsters: Array<DMTMonster>;
  getAllPlayers: Array<DMTPlayer>;
  getGameState: DMTGameStateResponse;
  getLocationInfo: DMTLocationResponse;
  getPlayer: DMTPlayerResponse;
  getPlayerStats: DMTPlayerStats;
  getPlayersAtLocation: Array<DMTPlayer>;
  health: DMTHealthCheck;
}


export interface DMTQueryGetLocationInfoArgs {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}


export interface DMTQueryGetPlayerArgs {
  slackId: Scalars['String']['input'];
}


export interface DMTQueryGetPlayerStatsArgs {
  slackId: Scalars['String']['input'];
}


export interface DMTQueryGetPlayersAtLocationArgs {
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
}

export interface DMTSpawnMonsterInput {
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}

export interface DMTSuccessResponse {
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
}

export interface DMTSurroundingTile {
  biomeName: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  direction: Scalars['String']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
}

export enum DMTTargetType {
  Monster = 'MONSTER',
  Player = 'PLAYER'
}

export interface DMTTileInfo {
  biomeName: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  height: Scalars['Float']['output'];
  moisture: Scalars['Float']['output'];
  temperature: Scalars['Float']['output'];
  x: Scalars['Float']['output'];
  y: Scalars['Float']['output'];
}

export type DMTMovePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
  input: DMTMovePlayerInput;
}>;


export type DMTMovePlayerMutation = { movePlayer: { success: boolean, message?: string | null, data?: { playerInfo: string, description: string, player: { id: string, name: string, x: number, y: number, hp: number, isAlive: boolean }, location: { x: number, y: number, biomeName: string, description?: string | null }, surroundingTiles: Array<{ x: number, y: number, biomeName: string, description?: string | null, direction: string }>, monsters: Array<{ id: string, name: string, hp: number, isAlive: boolean }> } | null } };

export type DMTAttackMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
  input: DMTAttackInput;
}>;


export type DMTAttackMutation = { attack: { success: boolean, message?: string | null, data?: { attackerName: string, defenderName: string, damage: number, defenderHp: number, defenderMaxHp: number, isDead: boolean, message: string, xpGained?: number | null } | null } };

export type DMTGetPlayerQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type DMTGetPlayerQuery = { getPlayer: { success: boolean, message?: string | null, data?: { id: string, name: string, x: number, y: number, hp: number, isAlive: boolean, nearbyMonsters?: Array<{ id: string, name: string, hp: number, isAlive: boolean }> | null } | null } };

export type DMTCreatePlayerMutationVariables = Exact<{
  input: DMTCreatePlayerInput;
}>;


export type DMTCreatePlayerMutation = { createPlayer: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, isAlive: boolean } | null } };

export type DMTRerollPlayerStatsMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type DMTRerollPlayerStatsMutation = { updatePlayerStats: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string, strength: number, agility: number, health: number } | null } };

export type DMTCompletePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type DMTCompletePlayerMutation = { updatePlayerStats: { success: boolean, message?: string | null, data?: { id: string, slackId: string, name: string, isAlive: boolean } | null } };


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
    MovePlayer(variables: DMTMovePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DMTMovePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DMTMovePlayerMutation>({ document: MovePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MovePlayer', 'mutation', variables);
    },
    Attack(variables: DMTAttackMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DMTAttackMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DMTAttackMutation>({ document: AttackDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'Attack', 'mutation', variables);
    },
    GetPlayer(variables: DMTGetPlayerQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DMTGetPlayerQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<DMTGetPlayerQuery>({ document: GetPlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPlayer', 'query', variables);
    },
    CreatePlayer(variables: DMTCreatePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DMTCreatePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DMTCreatePlayerMutation>({ document: CreatePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreatePlayer', 'mutation', variables);
    },
    RerollPlayerStats(variables: DMTRerollPlayerStatsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DMTRerollPlayerStatsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DMTRerollPlayerStatsMutation>({ document: RerollPlayerStatsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RerollPlayerStats', 'mutation', variables);
    },
    CompletePlayer(variables: DMTCompletePlayerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DMTCompletePlayerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DMTCompletePlayerMutation>({ document: CompletePlayerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CompletePlayer', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;