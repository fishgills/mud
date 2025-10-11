import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

const healthCheckSchema = z.object({
  status: z.literal('healthy'),
  timestamp: z.string(),
});

const tileInfoSchema = z.object({
  x: z.number(),
  y: z.number(),
  biomeName: z.string(),
  description: z.string().nullable().optional(),
  height: z.number(),
  temperature: z.number(),
  moisture: z.number(),
});

const monsterSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  strength: z.number().int(),
  agility: z.number().int(),
  health: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  isAlive: z.boolean(),
  lastMove: z.string(),
  spawnedAt: z.string(),
  biomeId: z.number().int(),
  worldTileId: z.number().int().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const playerSummarySchema = z.object({
  id: z.number().int(),
  slackId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  clientType: z.string().nullable().optional(),
  name: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  level: z.number().int(),
});

const playerSchema = playerSummarySchema.extend({
  hp: z.number().int(),
  maxHp: z.number().int(),
  strength: z.number().int(),
  agility: z.number().int(),
  health: z.number().int(),
  gold: z.number().int(),
  xp: z.number().int(),
  skillPoints: z.number().int(),
  isAlive: z.boolean(),
  lastAction: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string(),
  worldTileId: z.number().int().nullable().optional(),
  currentTile: tileInfoSchema.nullish(),
  nearbyPlayers: z.array(
    playerSummarySchema.pick({
      id: true,
      name: true,
      x: true,
      y: true,
      level: true,
    }),
  )
    .optional()
    .default([]),
  nearbyMonsters: z.array(
    monsterSchema.pick({
      id: true,
      name: true,
      hp: true,
      maxHp: true,
      isAlive: true,
      x: true,
      y: true,
    }),
  )
    .optional()
    .default([]),
});

const combatLogSchema = z.object({
  id: z.number().int(),
  attackerId: z.number().int(),
  attackerType: z.string(),
  defenderId: z.number().int(),
  defenderType: z.string(),
  damage: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  timestamp: z.string(),
  location: z
    .object({
      x: z.number().int(),
      y: z.number().int(),
    })
    .optional(),
});

const combatPlayerMessageSchema = z.object({
  slackId: z.string(),
  name: z.string(),
  message: z.string(),
  role: z.string(),
});

const combatResultSchema = z.object({
  success: z.boolean(),
  winnerName: z.string(),
  loserName: z.string(),
  totalDamageDealt: z.number().int(),
  roundsCompleted: z.number().int(),
  xpGained: z.number().int(),
  goldGained: z.number().int(),
  message: z.string(),
  playerMessages: z.array(combatPlayerMessageSchema),
});

const combatResponseSchema = successResponseSchema.extend({
  data: combatResultSchema.optional(),
});

const locationInfoSchema = z.object({
  location: tileInfoSchema,
  monsters: z.array(monsterSchema).optional().default([]),
  players: z.array(playerSchema).optional().default([]),
  recentCombat: z.array(combatLogSchema).optional().default([]),
});

const locationResponseSchema = successResponseSchema.extend({
  data: locationInfoSchema.optional(),
});

const sniffDataSchema = z.object({
  detectionRadius: z.number().int(),
  monsterName: z.string().optional(),
  distance: z.number().optional(),
  direction: z.string().optional(),
  monsterX: z.number().int().optional(),
  monsterY: z.number().int().optional(),
});

const sniffResponseSchema = successResponseSchema.extend({
  data: sniffDataSchema.optional(),
});

const monsterResponseSchema = successResponseSchema.extend({
  data: monsterSchema.optional(),
});

const gameStateSchema = z.object({
  currentTime: z.string(),
  totalPlayers: z.number().int(),
  totalMonsters: z.number().int(),
});

const gameStateResponseSchema = successResponseSchema.extend({
  data: gameStateSchema.optional(),
});

const playerStatsSchema = z.object({
  player: playerSchema,
  strengthModifier: z.number(),
  agilityModifier: z.number(),
  healthModifier: z.number(),
  dodgeChance: z.number(),
  baseDamage: z.string(),
  armorClass: z.number().int(),
  xpForNextLevel: z.number().int(),
  xpProgress: z.number().int(),
  xpNeeded: z.number().int(),
  recentCombat: z.array(combatLogSchema),
});

const playerStatsResponseSchema = successResponseSchema.extend({
  data: playerStatsSchema.optional(),
});

const surroundingPlayerInfoSchema = z.object({
  distance: z.number(),
  direction: z.string(),
  x: z.number().int(),
  y: z.number().int(),
});

const biomeSectorSummarySchema = z.object({
  biomeName: z.string(),
  proportion: z.number(),
  predominantDirections: z.array(z.string()),
});

const visiblePeakInfoSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  height: z.number(),
  distance: z.number(),
  direction: z.string(),
});

const visibleSettlementInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.string(),
  distance: z.number(),
  direction: z.string(),
});

const currentSettlementInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.string(),
  intensity: z.number(),
  isCenter: z.boolean(),
});

const lookViewDataSchema = z.object({
  location: tileInfoSchema,
  visibilityRadius: z.number(),
  biomeSummary: z.array(biomeSectorSummarySchema),
  visiblePeaks: z.array(visiblePeakInfoSchema),
  visibleSettlements: z.array(visibleSettlementInfoSchema),
  currentSettlement: currentSettlementInfoSchema.optional(),
  nearbyPlayers: z.array(surroundingPlayerInfoSchema).optional().default([]),
  inSettlement: z.boolean(),
  description: z.string(),
  monsters: z.array(monsterSchema).optional().default([]),
});

const performanceStatsSchema = z.object({
  totalMs: z.number(),
  playerMs: z.number(),
  worldCenterNearbyMs: z.number(),
  worldBoundsTilesMs: z.number(),
  worldExtendedBoundsMs: z.number(),
  tilesFilterMs: z.number(),
  peaksSortMs: z.number(),
  biomeSummaryMs: z.number(),
  settlementsFilterMs: z.number(),
  aiMs: z.number(),
  tilesCount: z.number().int(),
  peaksCount: z.number().int(),
  aiProvider: z.string(),
});

const lookViewResponseSchema = successResponseSchema.extend({
  data: lookViewDataSchema.optional(),
  perf: performanceStatsSchema.optional(),
});

const playerMoveResponseSchema = successResponseSchema.extend({
  player: playerSchema.optional(),
  monsters: z.array(monsterSchema).default([]),
  playersAtLocation: z.array(playerSchema).default([]),
});

const locationEntitiesSchema = z.object({
  players: z.array(playerSchema),
  monsters: z.array(monsterSchema),
});

const locationEntitiesResponseSchema = successResponseSchema.extend({
  data: locationEntitiesSchema.optional(),
});

const tickResultSchema = z.object({
  tick: z.number().int(),
  gameHour: z.number().int(),
  gameDay: z.number().int(),
  monstersSpawned: z.number().int(),
  monstersMoved: z.number().int(),
  combatEvents: z.number().int(),
  weatherUpdated: z.boolean(),
});

const processTickResponseSchema = successResponseSchema.extend({
  result: tickResultSchema.optional(),
});

const hasActivePlayersResponseSchema = z.object({
  hasActivePlayers: z.boolean(),
});

const createPlayerInputSchema = z
  .object({
    slackId: z.string().min(1).optional(),
    clientId: z.string().min(1).optional(),
    clientType: z
      .enum(['slack', 'discord', 'web'])
      .optional()
      .default('slack'),
    name: z.string().min(1),
    x: z.coerce.number().int().optional(),
    y: z.coerce.number().int().optional(),
  })
  .refine((data) => data.slackId || data.clientId, {
    message: 'Either slackId or clientId is required',
    path: ['slackId'],
  });

const movePlayerInputSchema = z.object({
  direction: z.enum(['n', 'e', 's', 'w']).optional(),
  distance: z.coerce.number().int().min(1).max(10).optional(),
  x: z.coerce.number().int().optional(),
  y: z.coerce.number().int().optional(),
});

const attackInputSchema = z.object({
  targetType: z.enum(['player', 'monster']),
  targetId: z.coerce.number().int().optional(),
  targetSlackId: z.string().min(1).optional(),
  ignoreLocation: z.coerce.boolean().optional(),
});

const playerStatsInputSchema = z
  .object({
    hp: z.coerce.number().int().optional(),
    xp: z.coerce.number().int().optional(),
    gold: z.coerce.number().int().optional(),
    level: z.coerce.number().int().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: 'At least one stat must be provided',
    },
  );

const spawnMonsterInputSchema = z.object({
  x: z.coerce.number().int(),
  y: z.coerce.number().int(),
});

const identifierBaseSchema = z.object({
  slackId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
});

const requireIdentifier = <T extends z.ZodRawShape>(
  shape: T,
  message = 'slackId or clientId is required',
) =>
  identifierBaseSchema.extend(shape).refine(
    (data) => data.slackId || data.clientId,
    {
      message,
    },
  );

const identifierSchema = requireIdentifier({});

const identifierWithNameSchema = identifierBaseSchema
  .extend({
    name: z.string().min(1).optional(),
  })
  .refine((data) => data.slackId || data.clientId || data.name, {
    message: 'Provide slackId, clientId, or name',
  });

const deletePlayerQuerySchema = z
  .object({
    slackId: z.string().min(1).optional(),
  })
  .refine((data) => !!data.slackId, {
    message: 'slackId is required',
  });

const movePlayerBodySchema = requireIdentifier({
  input: movePlayerInputSchema,
});

const attackBodySchema = requireIdentifier({
  input: attackInputSchema,
});

const updateStatsBodySchema = requireIdentifier({
  input: playerStatsInputSchema,
});

const spendSkillPointBodySchema = requireIdentifier({
  attribute: z.enum(['strength', 'agility', 'health']),
});

const singleIdentifierBodySchema = requireIdentifier({});

const locationQuerySchema = z.object({
  x: z.coerce.number(),
  y: z.coerce.number(),
});

const hasActivePlayersQuerySchema = z.object({
  minutesThreshold: z.coerce.number().int().min(1).default(30),
});

export const dmContract = c.router({
  health: {
    method: 'GET',
    path: '/health',
    responses: {
      200: healthCheckSchema,
    },
    summary: 'Health check for the Dungeon Master service.',
  },
  createPlayer: {
    method: 'POST',
    path: '/players',
    body: createPlayerInputSchema,
    responses: {
      201: successResponseSchema.extend({
        data: playerSchema,
      }),
    },
    summary: 'Create a new player.',
  },
  getPlayer: {
    method: 'GET',
    path: '/players',
    query: identifierWithNameSchema,
    responses: {
      200: successResponseSchema.extend({
        data: playerSchema.optional(),
      }),
    },
    summary:
      'Fetch a player by slackId, clientId, or name. Returns success with player data when found.',
  },
  getAllPlayers: {
    method: 'GET',
    path: '/players/all',
    responses: {
      200: z.array(playerSchema),
    },
    summary: 'Fetch all players.',
  },
  updatePlayerStats: {
    method: 'PATCH',
    path: '/players/stats',
    body: updateStatsBodySchema,
    responses: {
      200: successResponseSchema.extend({
        data: playerSchema.optional(),
      }),
    },
    summary: 'Update select statistics for a player.',
  },
  spendSkillPoint: {
    method: 'POST',
    path: '/players/skill-point',
    body: spendSkillPointBodySchema,
    responses: {
      200: successResponseSchema.extend({
        data: playerSchema.optional(),
      }),
    },
    summary: 'Spend a skill point for the specified player.',
  },
  rerollPlayerStats: {
    method: 'POST',
    path: '/players/reroll',
    body: singleIdentifierBodySchema,
    responses: {
      200: successResponseSchema.extend({
        data: playerSchema.optional(),
      }),
    },
    summary: 'Reroll a player’s stats.',
  },
  movePlayer: {
    method: 'POST',
    path: '/players/move',
    body: movePlayerBodySchema,
    responses: {
      200: playerMoveResponseSchema,
    },
    summary: 'Move a player according to the provided input.',
  },
  attack: {
    method: 'POST',
    path: '/combat/attack',
    body: attackBodySchema,
    responses: {
      200: combatResponseSchema,
    },
    summary: 'Perform an attack from the perspective of the provided player.',
  },
  getPlayerStats: {
    method: 'GET',
    path: '/players/detail-stats',
    query: identifierWithNameSchema,
    responses: {
      200: playerStatsResponseSchema,
    },
    summary: 'Retrieve detailed statistics for a player.',
  },
  getLookView: {
    method: 'GET',
    path: '/players/look-view',
    query: identifierSchema,
    responses: {
      200: lookViewResponseSchema,
    },
    summary:
      'Generate the “look” view for a player, returning tile, biome, and entity information.',
  },
  sniffNearestMonster: {
    method: 'GET',
    path: '/players/sniff',
    query: identifierSchema,
    responses: {
      200: sniffResponseSchema,
    },
    summary: 'Allow a player to sniff for the nearest monster.',
  },
  getLocationEntities: {
    method: 'GET',
    path: '/locations/entities',
    query: locationQuerySchema,
    responses: {
      200: locationEntitiesResponseSchema,
    },
    summary:
      'Fetch the players and monsters present at the specified coordinates.',
  },
  getPlayerLocationDetails: {
    method: 'GET',
    path: '/players/location',
    query: identifierSchema,
    responses: {
      200: locationResponseSchema,
    },
    summary:
      'Fetch enriched location information (players, monsters, combat logs) for the specified player.',
  },
  deletePlayer: {
    method: 'DELETE',
    path: '/players',
    query: deletePlayerQuerySchema,
    responses: {
      200: successResponseSchema.extend({
        data: playerSchema.optional(),
      }),
    },
    summary: 'Delete the specified player.',
  },
  processTick: {
    method: 'POST',
    path: '/system/process-tick',
    responses: {
      200: processTickResponseSchema,
    },
    summary: 'Trigger the game tick processing workflow.',
  },
  hasActivePlayers: {
    method: 'GET',
    path: '/system/has-active-players',
    query: hasActivePlayersQuerySchema,
    responses: {
      200: hasActivePlayersResponseSchema,
    },
    summary: 'Check if there are players active within the given time window.',
  },
  getGameState: {
    method: 'GET',
    path: '/system/game-state',
    responses: {
      200: gameStateResponseSchema,
    },
    summary: 'Retrieve aggregate information about the game state.',
  },
  getMonstersAtLocation: {
    method: 'GET',
    path: '/monsters',
    query: locationQuerySchema,
    responses: {
      200: z.array(monsterSchema),
    },
    summary: 'Fetch monsters present at the specified coordinates.',
  },
  getAllMonsters: {
    method: 'GET',
    path: '/monsters/all',
    responses: {
      200: z.array(monsterSchema),
    },
    summary: 'Fetch all monsters.',
  },
  spawnMonster: {
    method: 'POST',
    path: '/monsters',
    body: spawnMonsterInputSchema,
    responses: {
      201: monsterResponseSchema,
    },
    summary: 'Spawn a monster at the specified coordinates.',
  },
});

export type DmContract = typeof dmContract;
export type Player = z.infer<typeof playerSchema>;
export type PlayerSummary = z.infer<typeof playerSummarySchema>;
export type Monster = z.infer<typeof monsterSchema>;
export type CombatResult = z.infer<typeof combatResultSchema>;
export type CombatResponse = z.infer<typeof combatResponseSchema>;
export type PlayerStats = z.infer<typeof playerStatsSchema>;
export type PlayerStatsResponse = z.infer<typeof playerStatsResponseSchema>;
export type LookViewData = z.infer<typeof lookViewDataSchema>;
export type LookViewResponse = z.infer<typeof lookViewResponseSchema>;
export type SniffResponse = z.infer<typeof sniffResponseSchema>;
export type PlayerMoveResponse = z.infer<typeof playerMoveResponseSchema>;
export type LocationEntities = z.infer<typeof locationEntitiesSchema>;
export type LocationEntitiesResponse = z.infer<
  typeof locationEntitiesResponseSchema
>;
export type TickResult = z.infer<typeof tickResultSchema>;
export type ProcessTickResponse = z.infer<typeof processTickResponseSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
export type GameStateResponse = z.infer<typeof gameStateResponseSchema>;
export type MonsterResponse = z.infer<typeof monsterResponseSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
