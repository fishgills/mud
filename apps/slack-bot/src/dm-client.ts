import { authorizedFetch } from '@mud/gcp-auth';
import { Direction, TargetType } from './dm-types';
import { env } from './env';

export type JsonMap = Record<string, unknown>;
type JsonBody = JsonMap | unknown;

const dmBaseUrl = env.DM_API_BASE_URL.replace(/\/$/, '');

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

  const response = await authorizedFetch(url.toString(), {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `DM ${method} ${url.pathname} failed: ${response.status} ${response.statusText} ${text}`,
    );
  }

  return (await response.json()) as T;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface PlayerRecord extends Record<string, unknown> {
  id?: number;
  slackId?: string;
  clientId?: string;
  name?: string;
  x?: number;
  y?: number;
  hp?: number;
  maxHp?: number;
  strength?: number;
  agility?: number;
  health?: number;
  gold?: number;
  xp?: number;
  level?: number;
  skillPoints?: number;
  isAlive?: boolean;
  currentTile?: {
    x: number;
    y: number;
    biomeName: string;
    description?: string | null;
  };
  nearbyMonsters?: MonsterRecord[];
  nearbyPlayers?: PlayerRecord[];
}

export interface MonsterRecord extends Record<string, unknown> {
  id?: number;
  name?: string;
  type?: string;
  hp?: number;
  maxHp?: number;
  x?: number;
  y?: number;
  isAlive?: boolean;
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
    slackId: string;
    name: string;
    message: string;
    role: string;
  }>;
  perfBreakdown?: CombatPerformanceBreakdown;
}

export interface AttackPerformanceStats {
  totalMs: number;
  preCombatMs: number;
  combatMs: number;
  targetResolutionMs?: number;
  combatBreakdown?: CombatPerformanceBreakdown;
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
}

export interface CreatePlayerRequest {
  slackId?: string;
  clientId?: string;
  name: string;
}

export interface MovePlayerInput {
  direction?: Direction;
  distance?: number;
  x?: number;
  y?: number;
}

export interface MovePlayerRequest {
  slackId?: string;
  clientId?: string;
  input: MovePlayerInput;
}

export interface AttackInput {
  targetType: TargetType;
  targetId?: number;
  targetSlackId?: string;
  ignoreLocation?: boolean;
}

export interface AttackRequest {
  slackId: string;
  input: AttackInput;
}

export interface SpendSkillPointRequest {
  slackId: string;
  attribute: string;
}

export interface SimpleIdentifierRequest {
  slackId: string;
}

export async function createPlayer(
  input: CreatePlayerRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players', HttpMethod.POST, {
    body: input,
  });
}

export async function getPlayer(params: {
  slackId?: string;
  clientId?: string;
  name?: string;
}): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>('/players', HttpMethod.GET, {
    query: {
      slackId: params.slackId,
      clientId: params.clientId,
      name: params.name,
    },
  });
}

export async function movePlayer(
  input: MovePlayerRequest,
): Promise<PlayerMoveResponse> {
  const moveBody = normalizeMoveInput(input.input);
  return dmRequest<PlayerMoveResponse>('/movement/move', HttpMethod.POST, {
    body: {
      slackId: input.slackId,
      clientId: input.clientId,
      move: moveBody,
    },
  });
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
      slackId: input.slackId,
      input: { hp: 10 },
    },
  });
}

export async function deletePlayer(
  input: SimpleIdentifierRequest,
): Promise<PlayerResponse> {
  return dmRequest<PlayerResponse>(
    `/players/${encodeURIComponent(input.slackId)}`,
    HttpMethod.DELETE,
  );
}

export async function sniffNearestMonster(params: {
  slackId?: string;
  clientId?: string;
}): Promise<SniffResponse> {
  return dmRequest<SniffResponse>('/movement/sniff', HttpMethod.GET, {
    query: {
      slackId: params.slackId,
      clientId: params.clientId,
    },
  });
}

export async function getLookView(params: {
  slackId?: string;
  clientId?: string;
}): Promise<LookViewResponse> {
  return dmRequest<LookViewResponse>('/movement/look', HttpMethod.GET, {
    query: {
      slackId: params.slackId,
      clientId: params.clientId,
    },
  });
}

export async function getLocationEntities(params: {
  x: number;
  y: number;
}): Promise<LocationEntitiesResult> {
  const [players, monsters] = await Promise.all([
    dmRequest<PlayerRecord[]>('/players/location', HttpMethod.GET, {
      query: { x: String(params.x), y: String(params.y) },
    }),
    dmRequest<MonsterRecord[]>('/system/monsters', HttpMethod.GET, {
      query: { x: String(params.x), y: String(params.y) },
    }),
  ]);

  return { players, monsters };
}

export const dmClient = {
  createPlayer,
  getPlayer,
  movePlayer,
  attack,
  spendSkillPoint,
  rerollPlayerStats,
  completePlayer,
  deletePlayer,
  sniffNearestMonster,
  getLookView,
  getLocationEntities,
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
