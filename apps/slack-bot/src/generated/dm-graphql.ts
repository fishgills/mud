export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
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
  ignoreLocation?: InputMaybe<Scalars['Boolean']['input']>;
  targetId?: InputMaybe<Scalars['Int']['input']>;
  targetSlackId?: InputMaybe<Scalars['String']['input']>;
  targetType: TargetType;
};

export type BiomeSectorSummary = {
  __typename?: 'BiomeSectorSummary';
  biomeName: Scalars['String']['output'];
  predominantDirections: Array<Scalars['String']['output']>;
  proportion: Scalars['Float']['output'];
};

export type CombatLocation = {
  __typename?: 'CombatLocation';
  x: Scalars['Float']['output'];
  y: Scalars['Float']['output'];
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

export type CombatPlayerMessage = {
  __typename?: 'CombatPlayerMessage';
  message: Scalars['String']['output'];
  name: Scalars['String']['output'];
  slackId: Scalars['String']['output'];
};

export type CombatResponse = {
  __typename?: 'CombatResponse';
  data?: Maybe<CombatResult>;
  message?: Maybe<Scalars['String']['output']>;
  result?: Maybe<TickResult>;
  success: Scalars['Boolean']['output'];
};

export type CombatResult = {
  __typename?: 'CombatResult';
  goldGained: Scalars['Float']['output'];
  loserName: Scalars['String']['output'];
  message: Scalars['String']['output'];
  playerMessages: Array<CombatPlayerMessage>;
  roundsCompleted: Scalars['Float']['output'];
  success: Scalars['Boolean']['output'];
  totalDamageDealt: Scalars['Float']['output'];
  winnerName: Scalars['String']['output'];
  xpGained: Scalars['Float']['output'];
};

export type CombatRound = {
  __typename?: 'CombatRound';
  attackModifier: Scalars['Float']['output'];
  attackRoll: Scalars['Float']['output'];
  attackerName: Scalars['String']['output'];
  damage: Scalars['Float']['output'];
  defenderAC: Scalars['Float']['output'];
  defenderHpAfter: Scalars['Float']['output'];
  defenderName: Scalars['String']['output'];
  hit: Scalars['Boolean']['output'];
  killed: Scalars['Boolean']['output'];
  roundNumber: Scalars['Float']['output'];
  totalAttack: Scalars['Float']['output'];
};

export type CreatePlayerInput = {
  name: Scalars['String']['input'];
  slackId: Scalars['String']['input'];
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
};

export type CurrentSettlementInfo = {
  __typename?: 'CurrentSettlementInfo';
  intensity: Scalars['Float']['output'];
  isCenter: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  size: Scalars['String']['output'];
  type: Scalars['String']['output'];
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
  result?: Maybe<TickResult>;
  success: Scalars['Boolean']['output'];
};

export type HealthCheck = {
  __typename?: 'HealthCheck';
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type InitiativeRoll = {
  __typename?: 'InitiativeRoll';
  modifier: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  roll: Scalars['Float']['output'];
  total: Scalars['Float']['output'];
};

export type LocationInfo = {
  __typename?: 'LocationInfo';
  location: TileInfo;
  monsters?: Maybe<Array<Monster>>;
  players?: Maybe<Array<Player>>;
  recentCombat?: Maybe<Array<CombatLog>>;
};

export type LookViewData = {
  __typename?: 'LookViewData';
  biomeSummary: Array<BiomeSectorSummary>;
  currentSettlement?: Maybe<CurrentSettlementInfo>;
  description: Scalars['String']['output'];
  inSettlement: Scalars['Boolean']['output'];
  location: TileInfo;
  monsters?: Maybe<Array<Monster>>;
  nearbyPlayers?: Maybe<Array<NearbyPlayerInfo>>;
  visibilityRadius: Scalars['Float']['output'];
  visiblePeaks: Array<VisiblePeakInfo>;
  visibleSettlements: Array<VisibleSettlementInfo>;
};

export type LookViewResponse = {
  __typename?: 'LookViewResponse';
  data?: Maybe<LookViewData>;
  message?: Maybe<Scalars['String']['output']>;
  perf?: Maybe<PerformanceStats>;
  result?: Maybe<TickResult>;
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
  result?: Maybe<TickResult>;
  success: Scalars['Boolean']['output'];
};

export type MovePlayerInput = {
  direction?: InputMaybe<Direction>;
  x?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Attack a monster or another player at your current location */
  attack: CombatResponse;
  createPlayer: PlayerResponse;
  damagePlayer: PlayerResponse;
  deletePlayer: PlayerResponse;
  healPlayer: PlayerResponse;
  /** Increase a player skill (strength, agility, or health) by spending a skill point */
  increaseSkill: PlayerResponse;
  movePlayer: PlayerMoveResponse;
  processTick: SuccessResponse;
  rerollPlayerStats: PlayerResponse;
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


export type MutationDeletePlayerArgs = {
  slackId: Scalars['String']['input'];
};


export type MutationHealPlayerArgs = {
  amount: Scalars['Float']['input'];
  slackId: Scalars['String']['input'];
};


export type MutationIncreaseSkillArgs = {
  skill: Scalars['String']['input'];
  slackId: Scalars['String']['input'];
};


export type MutationMovePlayerArgs = {
  input: MovePlayerInput;
  slackId: Scalars['String']['input'];
};


export type MutationRerollPlayerStatsArgs = {
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

export type NearbyPlayerInfo = {
  __typename?: 'NearbyPlayerInfo';
  direction: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type PerformanceStats = {
  __typename?: 'PerformanceStats';
  aiMs: Scalars['Float']['output'];
  aiProvider: Scalars['String']['output'];
  biomeSummaryMs: Scalars['Float']['output'];
  peaksCount: Scalars['Int']['output'];
  peaksSortMs: Scalars['Float']['output'];
  playerMs: Scalars['Float']['output'];
  settlementsFilterMs: Scalars['Float']['output'];
  tilesCount: Scalars['Int']['output'];
  tilesFilterMs: Scalars['Float']['output'];
  totalMs: Scalars['Float']['output'];
  worldBoundsTilesMs: Scalars['Float']['output'];
  worldCenterNearbyMs: Scalars['Float']['output'];
  worldExtendedBoundsMs: Scalars['Float']['output'];
};

export type Player = {
  __typename?: 'Player';
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
  skillPoints: Scalars['Int']['output'];
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
  message?: Maybe<Scalars['String']['output']>;
  monsters: Array<Monster>;
  player: Player;
  playersAtLocation: Array<Player>;
  result?: Maybe<TickResult>;
  success: Scalars['Boolean']['output'];
};

export type PlayerResponse = {
  __typename?: 'PlayerResponse';
  data?: Maybe<Player>;
  message?: Maybe<Scalars['String']['output']>;
  result?: Maybe<TickResult>;
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
  getLookView: LookViewResponse;
  getMonstersAtLocation: Array<Monster>;
  getPlayer: PlayerResponse;
  getPlayerStats: PlayerStats;
  getPlayersAtLocation: Array<Player>;
  health: HealthCheck;
};


export type QueryGetLookViewArgs = {
  slackId: Scalars['String']['input'];
};


export type QueryGetMonstersAtLocationArgs = {
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
};


export type QueryGetPlayerArgs = {
  name?: InputMaybe<Scalars['String']['input']>;
  slackId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetPlayerStatsArgs = {
  name?: InputMaybe<Scalars['String']['input']>;
  slackId?: InputMaybe<Scalars['String']['input']>;
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
  result?: Maybe<TickResult>;
  success: Scalars['Boolean']['output'];
};

export enum TargetType {
  Monster = 'MONSTER',
  Player = 'PLAYER'
}

export type TickResult = {
  __typename?: 'TickResult';
  combatEvents: Scalars['Int']['output'];
  gameDay: Scalars['Int']['output'];
  gameHour: Scalars['Int']['output'];
  monstersMoved: Scalars['Int']['output'];
  monstersSpawned: Scalars['Int']['output'];
  tick: Scalars['Int']['output'];
  weatherUpdated: Scalars['Boolean']['output'];
};

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

export type VisiblePeakInfo = {
  __typename?: 'VisiblePeakInfo';
  direction: Scalars['String']['output'];
  distance: Scalars['Float']['output'];
  height: Scalars['Float']['output'];
  x: Scalars['Int']['output'];
  y: Scalars['Int']['output'];
};

export type VisibleSettlementInfo = {
  __typename?: 'VisibleSettlementInfo';
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


export type MovePlayerMutation = { __typename?: 'Mutation', movePlayer: { __typename?: 'PlayerMoveResponse', success: boolean, message?: string | null, monsters: Array<{ __typename?: 'Monster', name: string, id: string }>, playersAtLocation: Array<{ __typename?: 'Player', name: string, level: number }>, player: { __typename?: 'Player', x: number, y: number } } };

export type AttackMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
  input: AttackInput;
}>;


export type AttackMutation = { __typename?: 'Mutation', attack: { __typename?: 'CombatResponse', success: boolean, message?: string | null, data?: { __typename?: 'CombatResult', winnerName: string, loserName: string, totalDamageDealt: number, roundsCompleted: number, xpGained: number, goldGained: number, message: string, success: boolean, playerMessages: Array<{ __typename?: 'CombatPlayerMessage', slackId: string, name: string, message: string }> } | null } };

export type GetPlayerQueryVariables = Exact<{
  slackId?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetPlayerQuery = { __typename?: 'Query', getPlayer: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, skillPoints: number, isAlive: boolean, nearbyMonsters?: Array<{ __typename?: 'Monster', id: string, name: string, hp: number, isAlive: boolean }> | null } | null } };

export type GetLocationEntitiesQueryVariables = Exact<{
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
}>;


export type GetLocationEntitiesQuery = { __typename?: 'Query', getPlayersAtLocation: Array<{ __typename?: 'Player', id: string, slackId: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, skillPoints: number, isAlive: boolean }>, getMonstersAtLocation: Array<{ __typename?: 'Monster', id: string, name: string, type: string, hp: number, maxHp: number, strength: number, agility: number, health: number, x: number, y: number, isAlive: boolean }> };

export type GetPlayerWithLocationQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type GetPlayerWithLocationQuery = { __typename?: 'Query', getPlayer: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, skillPoints: number, isAlive: boolean, nearbyMonsters?: Array<{ __typename?: 'Monster', id: string, name: string, hp: number, isAlive: boolean }> | null, currentTile?: { __typename?: 'TileInfo', x: number, y: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number } | null, nearbyPlayers?: Array<{ __typename?: 'Player', id: string, name: string, hp: number, isAlive: boolean }> | null } | null } };

export type GetLookViewQueryVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type GetLookViewQuery = { __typename?: 'Query', getLookView: { __typename?: 'LookViewResponse', success: boolean, message?: string | null, data?: { __typename?: 'LookViewData', visibilityRadius: number, description: string, location: { __typename?: 'TileInfo', x: number, y: number, biomeName: string, description?: string | null, height: number, temperature: number, moisture: number }, currentSettlement?: { __typename?: 'CurrentSettlementInfo', name: string, type: string, size: string, intensity: number, isCenter: boolean } | null, monsters?: Array<{ __typename?: 'Monster', id: string, name: string }> | null, biomeSummary: Array<{ __typename?: 'BiomeSectorSummary', biomeName: string, proportion: number, predominantDirections: Array<string> }>, visiblePeaks: Array<{ __typename?: 'VisiblePeakInfo', x: number, y: number, height: number, distance: number, direction: string }>, visibleSettlements: Array<{ __typename?: 'VisibleSettlementInfo', name: string, type: string, size: string, distance: number, direction: string }>, nearbyPlayers?: Array<{ __typename?: 'NearbyPlayerInfo', distance: number, direction: string, x: number, y: number }> | null } | null } };

export type CreatePlayerMutationVariables = Exact<{
  input: CreatePlayerInput;
}>;


export type CreatePlayerMutation = { __typename?: 'Mutation', createPlayer: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string, x: number, y: number, hp: number, maxHp: number, strength: number, agility: number, health: number, gold: number, xp: number, level: number, skillPoints: number, isAlive: boolean, updatedAt: any } | null } };

export type RerollPlayerStatsMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type RerollPlayerStatsMutation = { __typename?: 'Mutation', rerollPlayerStats: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string, strength: number, agility: number, health: number, maxHp: number } | null } };

export type CompletePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type CompletePlayerMutation = { __typename?: 'Mutation', updatePlayerStats: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string, isAlive: boolean } | null } };

export type DeletePlayerMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
}>;


export type DeletePlayerMutation = { __typename?: 'Mutation', deletePlayer: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, slackId: string, name: string } | null } };

export type IncreaseSkillMutationVariables = Exact<{
  slackId: Scalars['String']['input'];
  skill: Scalars['String']['input'];
}>;


export type IncreaseSkillMutation = { __typename?: 'Mutation', increaseSkill: { __typename?: 'PlayerResponse', success: boolean, message?: string | null, data?: { __typename?: 'Player', id: string, name: string, strength: number, agility: number, health: number, hp: number, maxHp: number, skillPoints: number, xp: number, level: number, gold: number, x: number, y: number, isAlive: boolean } | null } };
