import { TargetType, AttackOrigin } from './dm-types';
import { env } from './env';
import type {
  Player,
  Monster,
  Item,
  PlayerItem,
  Prisma,
} from '@mud/database';
import type {
  GuildTradeResponse,
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

// Extended Player type with API-specific fields
export type PlayerRecord = Player &
  Prisma.SlackUserInclude & {
    // Additional slack-specific fields if needed
    isCreationComplete?: boolean;
    hasMoved?: boolean;
    hasBattled?: boolean;
    equipment?: {
      head?: { id: number; quality: string } | null;
      chest?: { id: number; quality: string } | null;
      legs?: { id: number; quality: string } | null;
      arms?: { id: number; quality: string } | null;
      weapon?: { id: number; quality: string } | null;
    };
    equipmentTotals?: EquipmentTotals;
    xpToNextLevel?: number;
  };

// Use Monster directly from Prisma
export type MonsterRecord = Monster;

// ItemRecord represents inventory items with optional display helpers.
type ItemDisplayMetadata = {
  // Include item relation when available
  item?: Item | null;
  // Convenience display helpers
  itemName?: string | null;
  name?: string;
  allowedSlots?: string[];
  slot?: string | null;
  equipped?: boolean;
  damageRoll?: string | null;
  defense?: number | null;
  value?: number | null;
  description?: string | null;
  itemType?: string | null;
  computedBonuses?: EquipmentTotals;
};

export type ItemRecord =
  PlayerItem & ItemDisplayMetadata;

export type EquipmentTotals = {
  attackBonus: number;
  damageBonus: number;
  armorBonus: number;
  vitalityBonus: number;
  weaponDamageRoll: string | null;
};

export interface ItemActionResponse extends SuccessResponse {
  data?: ItemRecord;
}

export interface PlayerResponse extends SuccessResponse {
  data?: PlayerRecord;
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


export interface CreatePlayerRequest {
  teamId?: string;
  userId?: string;
  name: string;
}


export interface AttackInput {
  targetType: TargetType;
  targetId?: number;
  targetUserId?: string;
  targetTeamId?: string;
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

export async function getMonsters(): Promise<MonsterRecord[]> {
  return dmRequest<MonsterRecord[]>('/system/monsters', HttpMethod.GET);
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
    `/players/${input.teamId}/${input.userId}`,
    HttpMethod.DELETE,
  );
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

// Feedback types
export interface SubmitFeedbackRequest {
  playerId: number;
  type: 'bug' | 'suggestion' | 'general';
  content: string;
}

export interface SubmitFeedbackResponse extends SuccessResponse {
  feedbackId?: number;
  githubIssueUrl?: string;
  rejectionReason?: string;
}

export interface FeedbackHistoryItem {
  id: number;
  type: string;
  summary: string | null;
  status: string;
  githubIssueUrl: string | null;
  createdAt: string;
}

export interface FeedbackHistoryResponse extends SuccessResponse {
  feedbacks: FeedbackHistoryItem[];
}

export async function submitFeedback(
  input: SubmitFeedbackRequest,
): Promise<SubmitFeedbackResponse> {
  return dmRequest<SubmitFeedbackResponse>('/feedback', HttpMethod.POST, {
    body: input,
  });
}

export async function getFeedbackHistory(
  playerId: number,
): Promise<FeedbackHistoryResponse> {
  return dmRequest<FeedbackHistoryResponse>(
    `/feedback/history/${encodeURIComponent(String(playerId))}`,
    HttpMethod.GET,
  );
}

export interface DeleteFeedbackResponse {
  success: boolean;
  message?: string;
}

export async function deleteFeedback(
  feedbackId: number,
  playerId: number,
): Promise<DeleteFeedbackResponse> {
  return dmRequest<DeleteFeedbackResponse>(
    `/feedback/${encodeURIComponent(String(feedbackId))}`,
    HttpMethod.DELETE,
    { body: { playerId } },
  );
}

export const dmClient = {
  createPlayer,
  getPlayer,
  guildBuyItem,
  guildSellItem,
  guildListCatalog,
  attack,
  spendSkillPoint,
  rerollPlayerStats,
  completePlayer,
  deletePlayer,
  getPlayerItems,
  getMonsterById,
  getMonsters,
  equip,
  unequip,
  submitFeedback,
  getFeedbackHistory,
  deleteFeedback,
};
