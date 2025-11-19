import { Direction, TargetType, AttackOrigin } from './dm-types';
import { env } from './env';
import type {
  Player,
  Monster,
  WorldItem,
  Item,
  PlayerItem,
  Prisma,
} from '@mud/database';
import type {
  GuildTradeResponse,
  GuildTeleportResponse,
  GuildCatalogItem as GuildCatalogItemContract,
} from '@mud/api-contracts';

export type JsonMap = Record<string, unknown>;
type JsonBody = JsonMap | unknown;

const dmBaseUrl = env.DM_API_BASE_URL;

const enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  DELETE = 'DELETE',
}

async function dmRequest<T>(
  path: string,
  method: HttpMethod,
  options: {
    query?: Record<string, string | undefined>;
    body?: JsonBody;
  } = {},
): Promise<T> {
  const url = new URL(`${dmBaseUrl}${path}`);
  const { query, body } = options;

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      if (data && typeof data.message === 'string') {
        message = data.message;
      } else {
        message = `${message} ${JSON.stringify(data)}`;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
  code?: string;
}

export type TeleportState = 'entered' | 'awaiting_choice' | 'exited';

export type HqExitMode = 'return' | 'random';

export interface TeleportResponse extends SuccessResponse {
  state: TeleportState;
  player?: PlayerRecord;
  destination?: { x: number; y: number };
  lastWorldPosition?: { x: number | null; y: number | null };
  mode?: HqExitMode;
}

// Extended Player type with API-specific fields
export type PlayerRecord = Player &
  Prisma.SlackUserInclude & {
    // Additional slack-specific fields if needed
    isCreationComplete?: boolean;
    currentTile?: {
      x: number;
      y: number;
      biomeName: string;
      description?: string | null;
    };
    nearbyMonsters?: MonsterRecord[];
    nearbyPlayers?: PlayerRecord[];
    equipment?: {
      head?: { id: number; quality: string } | null;
      chest?: { id: number; quality: string } | null;
      legs?: { id: number; quality: string } | null;
      arms?: { id: number; quality: string } | null;
      weapon?: { id: number; quality: string } | null;
    };
    equipmentTotals?: EquipmentTotals;
  };

// Use Monster directly from Prisma
export type MonsterRecord = Monster;

// ItemRecord supports both PlayerItem (inventory) and WorldItem (world items)
// This type is flexible to work with both API responses
export type ItemRecord =
  | (WorldItem & {
      // Include item details from relation if available
      item?: Item | null;
      // Convenience properties for display
      itemName?: string | null;
      name?: string; // from item.name when item relation is loaded
      allowedSlots?: string[];
      // PlayerItem-specific fields when used as inventory item
      slot?: string | null;
      equipped?: boolean;
    })
  | (PlayerItem & {
      // Include item details when available
      item?: Item | null;
      itemName?: string | null;
      name?: string; // convenience mapping
      allowedSlots?: string[];
    });

export type EquipmentTotals = {
  attackBonus: number;
  damageBonus: number;
  armorBonus: number;
  vitalityBonus: number;
};

export interface ItemActionResponse extends SuccessResponse {
  data?: ItemRecord;
}

// Extended Item type for detailed item information
export type ItemDetails = Item & {
  value?: number;
  attack?: number | null;
  defense?: number | null;
  healthBonus?: number | null;
  slot?: string | null;
};

export interface ItemDetailsResponse extends SuccessResponse {
  data?: ItemDetails;
}

export interface PlayerResponse extends SuccessResponse {
  data?: PlayerRecord;
}

export interface PlayerMoveResponse extends SuccessResponse {
  player: PlayerRecord;
  monsters: MonsterRecord[];
  playersAtLocation: PlayerRecord[];
}

export interface CombatResult {
  winnerName: string;
  loserName: string;
  totalDamageDealt: number;
  roundsCompleted: number;
  xpGained: number;
  goldGained: number;
  message: string;
  playerMessages?: Array<{
    name: string;
    message: string;
    role: string;
    userId?: string;
    teamId?: string;
    blocks?: Array<Record<string, unknown>>;
  }>;
  perfBreakdown?: CombatPerformanceBreakdown;
}

export interface AttackPerformanceStats {
  totalMs: number;
  preCombatMs: number;
  combatMs: number;
  targetResolutionMs?: number;
  combatBreakdown?: CombatPerformanceBreakdown;
  attackOrigin?: AttackOrigin;
}

export interface CombatMessagePerformance {
  totalMs: number;
  attackerMessageMs?: number;
  defenderMessageMs?: number;
  observerNarrativeMs?: number;
  observerSummaryMs?: number;
  observerLookupMs?: number;
}

export interface CombatPerformanceBreakdown {
  totalMs: number;
  loadCombatantsMs: number;
  validationMs: number;
  runCombatMs: number;
  applyResultsMs: number;
  messagePrepMs: number;
  notificationMs: number;
  messageDetails?: CombatMessagePerformance;
}

export interface CombatResponse extends SuccessResponse {
  data?: CombatResult;
  perf?: AttackPerformanceStats;
}

export type SniffProximity =
  | 'immediate'
  | 'close'
  | 'near'
  | 'far'
  | 'distant'
  | 'unknown';

export interface SniffData {
  detectionRadius: number;
  monsterName?: string;
  distanceLabel?: string;
  proximity?: SniffProximity;
  direction?: string;
  monsterX?: number;
  monsterY?: number;
}

export interface SniffResponse extends SuccessResponse {
  data?: SniffData;
}

export interface LookViewData extends JsonMap {
  description?: string;
  location?: {
    x: number;
    y: number;
    biomeName: string;
    description?: string | null;
  };
}

export interface LookViewResponse extends SuccessResponse {
  data?: LookViewData;
  perf?: JsonMap;
}

export interface LocationEntitiesResult {
  players: PlayerRecord[];
  monsters: MonsterRecord[];
  items: ItemRecord[];
}

interface LocationCollectionResponse<T> extends SuccessResponse {
  data?: T[];
}

export interface CreatePlayerRequest {
  teamId?: string;
  userId?: string;
  name: string;
}

export interface MovePlayerInput {
  direction?: Direction;
  distance?: number;
  x?: number;
  y?: number;
}

export interface MovePlayerRequest {
  teamId: string;
  userId: string;
  input: MovePlayerInput;
}

export interface AttackInput {
  targetType: TargetType;
  targetId?: number;
  targetUserId?: string;
  targetTeamId?: string;
  ignoreLocation?: boolean;
  attackOrigin?: AttackOrigin;
}

export interface AttackRequest {
  teamId: string;
  userId: string;
  input: AttackInput;
}

export interface SpendSkillPointRequest {
  teamId: string;
  userId: string;
  attribute: string;
}

export interface SimpleIdentifierRequest {
  teamId: string;
  userId: string;
}

export async function createPlayer(
  input: CreatePlayerRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players', HttpMethod.POST, {
    body: input,
  });
}

export async function getPlayer(params: {
  teamId: string;
  userId: string;
}): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players', HttpMethod.GET, {
    query: {
      teamId: params.teamId,
      userId: params.userId,
    },
  });
}

export async function getMonsterById(
  monsterId: number,
): Promise<MonsterRecord | null> {
  return dmRequest<MonsterRecord | null>(
    `/system/monster/${encodeURIComponent(String(monsterId))}`,
    HttpMethod.GET,
  );
}

export async function getLeaderboard(params?: {
  limit?: number;
  teamId?: string;
}): Promise<{ success: boolean; data?: PlayerRecord[] }> {
  return dmRequest('/players/leaderboard', HttpMethod.GET, {
    query: {
      limit: params?.limit?.toString(),
      teamId: params?.teamId,
    },
  });
}

export async function movePlayer(
  input: MovePlayerRequest,
): Promise<PlayerMoveResponse> {
  const moveBody = normalizeMoveInput(input.input);
  return dmRequest<PlayerMoveResponse>('/movement/move', HttpMethod.POST, {
    body: {
      teamId: input.teamId,
      userId: input.userId,
      move: moveBody,
    },
  });
}

export async function teleportPlayer(params: {
  teamId: string;
  userId: string;
  mode?: HqExitMode;
}): Promise<TeleportResponse> {
  const body: Record<string, unknown> = {
    teamId: params.teamId,
    userId: params.userId,
  };
  if (params.mode) {
    body.mode = params.mode;
  }

  return dmRequest<TeleportResponse>('/movement/teleport', HttpMethod.POST, {
    body,
  });
}

export async function guildBuyItem(params: {
  teamId: string;
  userId: string;
  sku: string;
  quantity?: number;
}): Promise<GuildTradeResponse> {
  return dmRequest('/guild/shop/buy', HttpMethod.POST, {
    body: {
      teamId: params.teamId,
      userId: params.userId,
      sku: params.sku,
      quantity: params.quantity,
    },
  });
}

export async function guildSellItem(params: {
  teamId: string;
  userId: string;
  playerItemId: number;
  quantity?: number;
}): Promise<GuildTradeResponse> {
  return dmRequest('/guild/shop/sell', HttpMethod.POST, {
    body: {
      teamId: params.teamId,
      userId: params.userId,
      playerItemId: params.playerItemId,
      quantity: params.quantity,
    },
  });
}

export async function guildTeleport(params: {
  teamId: string;
  userId: string;
}): Promise<GuildTeleportResponse> {
  return dmRequest<GuildTeleportResponse>('/guild/teleport', HttpMethod.POST, {
    body: {
      teamId: params.teamId,
      userId: params.userId,
      requestedAt: new Date().toISOString(),
      correlationId: `slack-${params.userId}-${Date.now()}`,
    },
  });
}

export type GuildCatalogItem = GuildCatalogItemContract;

export async function guildListCatalog(): Promise<GuildCatalogItem[]> {
  return dmRequest<GuildCatalogItem[]>('/guild/shop/list', HttpMethod.GET);
}

export async function attack(input: AttackRequest): Promise<CombatResponse> {
  return dmRequest<CombatResponse>('/players/attack', HttpMethod.POST, {
    body: input,
  });
}

export async function spendSkillPoint(
  input: SpendSkillPointRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>(
    '/players/spend-skill-point',
    HttpMethod.POST,
    {
      body: input,
    },
  );
}

export async function rerollPlayerStats(
  input: SimpleIdentifierRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players/reroll', HttpMethod.POST, {
    body: input,
  });
}

export async function completePlayer(
  input: SimpleIdentifierRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players/stats', HttpMethod.POST, {
    body: {
      teamId: input.teamId,
      userId: input.userId,
      input: { completeCreation: true },
    },
  });
}

export async function deletePlayer(
  input: SimpleIdentifierRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>(
    `/players/${input.userId}`,
    HttpMethod.DELETE,
  );
}

export async function sniffNearestMonster(params: {
  teamId: string;
  userId: string;
}): Promise<SniffResponse> {
  return dmRequest<SniffResponse>('/movement/sniff', HttpMethod.GET, {
    query: {
      teamId: params.teamId,
      userId: params.userId,
    },
  });
}

export async function getLookView(params: {
  teamId: string;
  userId: string;
}): Promise<LookViewResponse> {
  return dmRequest<LookViewResponse>('/movement/look', HttpMethod.GET, {
    query: {
      teamId: params.teamId,
      userId: params.userId,
    },
  });
}

export async function getPlayerItems(params: {
  teamId: string;
  userId: string;
}): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players/items', HttpMethod.GET, {
    query: {
      teamId: params.teamId,
      userId: params.userId,
    },
  });
}

export async function pickup(input: {
  teamId: string;
  userId: string;
  worldItemId?: number;
}): Promise<SuccessResponse & { item?: ItemRecord; data?: unknown }> {
  return dmRequest<SuccessResponse & { item?: ItemRecord; data?: unknown }>(
    '/players/pickup',
    HttpMethod.POST,
    {
      body: input,
    },
  );
}

export async function equip(input: {
  teamId: string;
  userId: string;
  playerItemId?: number;
  slot?: string;
}): Promise<ItemActionResponse> {
  return dmRequest<ItemActionResponse>('/players/equip', HttpMethod.POST, {
    body: input,
  });
}

export async function unequip(input: {
  teamId: string;
  userId: string;
  playerItemId?: number;
}): Promise<ItemActionResponse> {
  return dmRequest<ItemActionResponse>('/players/unequip', HttpMethod.POST, {
    body: input,
  });
}

export async function drop(input: {
  teamId: string;
  userId: string;
  playerItemId?: number;
}): Promise<ItemActionResponse> {
  return dmRequest<ItemActionResponse>('/players/drop', HttpMethod.POST, {
    body: input,
  });
}

export async function getItemDetails(
  itemId: number,
): Promise<ItemDetailsResponse> {
  return dmRequest<ItemDetailsResponse>(
    `/items/${encodeURIComponent(String(itemId))}`,
    HttpMethod.GET,
  );
}

function assertLocationResponse<T>(
  endpoint: string,
  response: LocationCollectionResponse<T>,
): T[] {
  if (!response.success) {
    throw new Error(
      `${endpoint} failed: ${response.message ?? 'unknown error'}`,
    );
  }
  return response.data ?? [];
}

export async function getLocationPlayers(params: {
  x: number;
  y: number;
}): Promise<PlayerRecord[]> {
  const response = await dmRequest<LocationCollectionResponse<PlayerRecord>>(
    '/location/players',
    HttpMethod.GET,
    {
      query: { x: String(params.x), y: String(params.y) },
    },
  );
  return assertLocationResponse('getLocationPlayers', response);
}

export async function getLocationMonsters(params: {
  x: number;
  y: number;
}): Promise<MonsterRecord[]> {
  const response = await dmRequest<LocationCollectionResponse<MonsterRecord>>(
    '/location/monsters',
    HttpMethod.GET,
    {
      query: { x: String(params.x), y: String(params.y) },
    },
  );
  return assertLocationResponse('getLocationMonsters', response);
}

export async function getLocationItems(params: {
  x: number;
  y: number;
}): Promise<ItemRecord[]> {
  const response = await dmRequest<LocationCollectionResponse<ItemRecord>>(
    '/location/items',
    HttpMethod.GET,
    {
      query: { x: String(params.x), y: String(params.y) },
    },
  );
  return assertLocationResponse('getLocationItems', response);
}

export async function getLocationEntities(params: {
  x: number;
  y: number;
}): Promise<LocationEntitiesResult> {
  const [players, monsters, items] = await Promise.all([
    getLocationPlayers(params),
    getLocationMonsters(params),
    getLocationItems(params),
  ]);

  return { players, monsters, items };
}

export const dmClient = {
  createPlayer,
  getPlayer,
  movePlayer,
  teleportPlayer,
  guildBuyItem,
  guildSellItem,
  guildTeleport,
  guildListCatalog,
  attack,
  spendSkillPoint,
  rerollPlayerStats,
  completePlayer,
  deletePlayer,
  sniffNearestMonster,
  getLookView,
  getLocationEntities,
  getPlayerItems,
  getMonsterById,
  pickup,
  equip,
  unequip,
  drop,
  getItemDetails,
  getLocationPlayers,
  getLocationMonsters,
  getLocationItems,
};

type DirectionCode = 'n' | 's' | 'e' | 'w';

const directionToCode: Record<Direction, DirectionCode> = {
  [Direction.North]: 'n',
  [Direction.South]: 's',
  [Direction.East]: 'e',
  [Direction.West]: 'w',
};

function normalizeMoveInput(input: MovePlayerInput): {
  direction?: DirectionCode;
  distance?: number;
  x?: number;
  y?: number;
} {
  const result: {
    direction?: DirectionCode;
    distance?: number;
    x?: number;
    y?: number;
  } = {};

  if (input.direction) {
    const code = directionToCode[input.direction];
    if (code) {
      result.direction = code;
    }
  }

  if (typeof input.distance === 'number' && Number.isFinite(input.distance)) {
    result.distance = input.distance;
  }

  if (typeof input.x === 'number' && Number.isFinite(input.x)) {
    result.x = input.x;
  }

  if (typeof input.y === 'number' && Number.isFinite(input.y)) {
    result.y = input.y;
  }

  return result;
}
