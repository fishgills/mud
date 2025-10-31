import type {
  ContextBlock,
  DividerBlock,
  KnownBlock,
  SectionBlock,
} from '@slack/types';

export interface LocationData {
  location: {
    x: number;
    y: number;
    biomeName: string;
    description?: string | null;
  };
  surroundingTiles?: Array<{
    direction: string;
    biomeName: string;
    description?: string | null;
  }>;
  monsters?: Array<{
    id: string;
    name: string;
    hp?: number;
    isAlive?: boolean;
  }>;
  playerInfo?: string | null;
  description?: string | null;
}

export const formatLocationMessage = (
  data: LocationData,
  moveDirection?: string,
): string => {
  let msg = '';

  if (moveDirection) {
    msg += `You moved ${moveDirection}.\n`;
  }

  msg += `You are now at (${data.location.x}, ${data.location.y}) in a ${data.location.biomeName} biome.\n`;

  // Use the main description from the data if available, otherwise fall back to location description
  const descriptionRaw = data.description || data.location.description;
  const description = descriptionRaw ? sanitizeDescription(descriptionRaw) : '';
  if (description) {
    msg += `${description}\n`;
  }

  if (data.surroundingTiles && data.surroundingTiles.length) {
    msg += 'Nearby tiles:\n';
    for (const tile of data.surroundingTiles) {
      const td = tile.description
        ? sanitizeDescription(tile.description)
        : 'no description';
      msg += `- ${tile.direction}: ${tile.biomeName} (${td})\n`;
    }
  }

  if (data.monsters && data.monsters.length) {
    msg += `Monsters nearby: ${data.monsters.map((m) => m.name).join(', ')}\n`;
  }

  if (data.playerInfo) {
    msg += data.playerInfo + '\n';
  }

  return msg;
};

// Build a Slack Block Kit representation for a location update
export function buildLocationBlocks(
  data: LocationData,
  moveDirection?: string,
  opts?: { includeDebug?: boolean },
): KnownBlock[] {
  const blocks: KnownBlock[] = [];
  const { includeDebug = true } = opts || {};

  const heading = moveDirection
    ? `You moved ${moveDirection}.`
    : 'Location update';
  const headingBlock: SectionBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `*${heading}*` },
  };
  blocks.push(headingBlock);

  const desc = data.description || data.location.description;
  const safeDesc = desc ? sanitizeDescription(desc) : '';
  const bodyLines: string[] = [];
  bodyLines.push(
    `You are at *(${data.location.x}, ${data.location.y})* in a *${data.location.biomeName}* biome.`,
  );
  if (safeDesc) bodyLines.push(safeDesc);
  const bodyBlock: SectionBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: bodyLines.join('\n') },
  };
  blocks.push(bodyBlock);

  if (data.surroundingTiles && data.surroundingTiles.length) {
    const nearbyList = data.surroundingTiles
      .map((t) => {
        const sd = t.description ? sanitizeDescription(t.description) : '';
        return `• *${t.direction}*: ${t.biomeName}${sd ? ` — ${sd}` : ''}`;
      })
      .join('\n');
    const nearbyDivider: DividerBlock = { type: 'divider' };
    const nearbyBlock: SectionBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Nearby tiles*\n${nearbyList}` },
    };
    blocks.push(nearbyDivider, nearbyBlock);
  }

  if (data.monsters && data.monsters.length) {
    const monsters = data.monsters
      .map((m) => `${m.name}${typeof m.hp === 'number' ? ` (${m.hp}hp)` : ''}`)
      .join(', ');
    const monstersBlock: ContextBlock = {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Monsters nearby: ${monsters}` }],
    };
    blocks.push(monstersBlock);
  }

  if (data.playerInfo) {
    const playerInfoDivider: DividerBlock = { type: 'divider' };
    const playerInfoBlock: SectionBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text: data.playerInfo },
    };
    blocks.push(playerInfoDivider, playerInfoBlock);
  }

  if (includeDebug) {
    const debugDivider: DividerBlock = { type: 'divider' };
    const debugBlock: ContextBlock = {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Debug: x=${data.location.x}, y=${data.location.y}`,
        },
      ],
    };
    blocks.push(debugDivider, debugBlock);
  }

  return blocks;
}

// Remove triple-backtick code blocks (e.g., ```slack { ... } ``` or ```json ... ```)
export function sanitizeDescription(text: string): string {
  try {
    // Strip code fences
    let cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
    // Collapse excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned;
  } catch {
    return text;
  }
}

// --- Centralized occupants rendering helpers ---
import { extractSlackId, resolveSlackUserId } from '../utils/clientId';
import type { MonsterRecord, PlayerRecord } from '../dm-client';

type DmClient = (typeof import('../dm-client'))['dmClient'];

let dmClientPromise: Promise<DmClient> | null = null;

const getDmClient = async (): Promise<DmClient> => {
  if (!dmClientPromise) {
    dmClientPromise = import('../dm-client').then((mod) => mod.dmClient);
  }

  return dmClientPromise;
};

export type NearbyPlayer = {
  id?: string | number;
  name: string;
  slackId?: string | null;
  clientId?: string | null;
  isAlive?: boolean | null;
};

export type NearbyMonster = {
  id?: string | number;
  name: string;
  isAlive?: boolean | null;
  hp?: number | null;
};

export type NearbyItem = {
  id?: number | string;
  itemId?: number | null; // catalog id
  itemName?: string | null; // friendly name when available
  quantity?: number | null;
  quality?: string | null;
  x?: number | null;
  y?: number | null;
};

function toNearbyItem(
  record: NearbyItem | Record<string, unknown>,
): NearbyItem {
  const r = record as Record<string, unknown>;
  const id =
    typeof r.id === 'number' || typeof r.id === 'string'
      ? (r.id as number | string)
      : undefined;
  const itemId = typeof r.itemId === 'number' ? (r.itemId as number) : null;
  const itemName =
    typeof r.itemName === 'string' ? (r.itemName as string) : null;
  const quantity =
    typeof r.quantity === 'number' ? (r.quantity as number) : null;
  const quality = typeof r.quality === 'string' ? (r.quality as string) : null;
  const x = typeof r.x === 'number' ? (r.x as number) : null;
  const y = typeof r.y === 'number' ? (r.y as number) : null;

  return { id, itemId, itemName, quantity, quality, x, y };
}

// Build a consistent single-message summary for items at a location
export function buildItemsSummary(items: NearbyItem[] = []): string | null {
  if (!items || items.length === 0) return null;
  const lines: string[] = ['Items here:'];
  for (const it of items) {
    const qty = typeof it.quantity === 'number' ? it.quantity : 1;
    const name =
      it.itemName ??
      (it.itemId ? `item #${it.itemId}` : `item #${it.id ?? 'unknown'}`);
    const quality = it.quality ? ` (${it.quality})` : '';
    lines.push(`- ${qty}x ${name}${quality}`);
  }
  return lines.join('\n');
}

// Send items summary using arrays already available (e.g., from look response)
export function buildItemsBlocks(
  items: NearbyItem[] = [],
  opts?: { includeDebug?: boolean },
): KnownBlock[] {
  const blocks: KnownBlock[] = [];
  if (!items || items.length === 0) return blocks;

  const heading: SectionBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: '*Items here*' },
  };
  blocks.push(heading);

  const itemLines = items.map((it) => {
    const qty = typeof it.quantity === 'number' ? it.quantity : 1;
    const name =
      it.itemName ??
      (it.itemId ? `item #${it.itemId}` : `item #${it.id ?? 'unknown'}`);
    const quality = it.quality ? ` (${it.quality})` : '';
    return `• ${qty}x ${name}${quality}`;
  });

  const itemsBlock: SectionBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: itemLines.join('\n') },
  };
  blocks.push(itemsBlock);

  const includeDebug = opts?.includeDebug ?? true;
  if (includeDebug) {
    const debugBlock: ContextBlock = {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Debug: items=${items.length}` }],
    };
    blocks.push(debugBlock);
  }

  return blocks;
}

export async function sendItemsSummary(
  say: (message: { text?: string; blocks?: KnownBlock[] }) => Promise<unknown>,
  items: Array<NearbyItem | Record<string, unknown>> | undefined,
): Promise<void> {
  const normalized: NearbyItem[] = (items || []).map((i) => toNearbyItem(i));
  if (!normalized || normalized.length === 0) return;

  const blocks = buildItemsBlocks(normalized, { includeDebug: false });
  const text = buildItemsSummary(normalized) ?? 'Items here.';

  if (blocks.length > 0) {
    await say({ blocks, text });
  } else {
    await say({ text });
  }
}

// Build a consistent single-message summary for co-located players/monsters
export function buildOccupantsSummary(
  players: NearbyPlayer[] = [],
  monsters: NearbyMonster[] = [],
): string | null {
  const playerNames = players.filter((p) => !!p && !!p.name).map((p) => p.name);
  const monsterNames = monsters
    .filter((m) => !!m && !!m.name)
    .map((m) => m.name);

  if (playerNames.length === 0 && monsterNames.length === 0) {
    return null;
  }

  const lines: string[] = ['You see at your location:'];
  if (playerNames.length > 0)
    lines.push(`- Players: ${playerNames.join(', ')}`);
  if (monsterNames.length > 0)
    lines.push(`- Monsters: ${monsterNames.join(', ')}`);

  return lines.join('\n');
}

// Fetch current-tile occupants and return the standard summary text
type OccupantFilterOptions = {
  currentSlackUserId?: string;
  currentClientId?: string;
};

export async function getOccupantsSummaryAt(
  x: number,
  y: number,
  opts?: OccupantFilterOptions,
): Promise<string | null> {
  const client = await getDmClient();
  const res = await client.getLocationEntities({ x, y });
  const players: NearbyPlayer[] = (res.players || [])
    .map((p) => toNearbyPlayer(p))
    .filter((p) => shouldIncludePlayer(p, opts));
  const monsters = (res.monsters || []).map((m) => toNearbyMonster(m));
  return buildOccupantsSummary(players, monsters);
}

// Send occupants summary using arrays already available (e.g., from move mutation)
export async function sendOccupantsSummary(
  say: (message: { text: string }) => Promise<unknown>,
  players: Array<NearbyPlayer | PlayerRecord> | undefined,
  monsters: Array<NearbyMonster | MonsterRecord> | undefined,
  opts?: OccupantFilterOptions,
): Promise<void> {
  const normalizedPlayers: NearbyPlayer[] = (players || []).map((p) =>
    toNearbyPlayer(p),
  );
  const filteredPlayers = normalizedPlayers.filter((p) =>
    shouldIncludePlayer(p, opts),
  );
  const normalizedMonsters: NearbyMonster[] = (monsters || []).map((m) =>
    toNearbyMonster(m),
  );
  const text = buildOccupantsSummary(filteredPlayers, normalizedMonsters);
  if (text) {
    await say({ text });
  }
}

function toNearbyPlayer(record: NearbyPlayer | PlayerRecord): NearbyPlayer {
  const id = record.id ?? null;
  const name =
    typeof record.name === 'string' && record.name.length
      ? record.name
      : 'Unknown Adventurer';
  const slackId = extractSlackId(record) ?? null;
  const clientId = typeof record.clientId === 'string' ? record.clientId : null;
  const isAliveValue =
    typeof record.isAlive === 'boolean' ? record.isAlive : null;

  return {
    id: id ?? undefined,
    name,
    slackId,
    clientId,
    isAlive: isAliveValue,
  };
}

function toNearbyMonster(record: NearbyMonster | MonsterRecord): NearbyMonster {
  const id = record.id ?? null;
  const name =
    typeof record.name === 'string' && record.name.length
      ? record.name
      : 'Unknown Monster';
  const isAliveValue =
    typeof record.isAlive === 'boolean' ? record.isAlive : null;
  const hpValue = typeof record.hp === 'number' ? record.hp : null;

  return {
    id: id ?? undefined,
    name,
    isAlive: isAliveValue,
    hp: hpValue,
  };
}

function shouldIncludePlayer(
  player: NearbyPlayer,
  opts?: OccupantFilterOptions,
): boolean {
  if (!opts) {
    return true;
  }

  const { currentSlackUserId, currentClientId } = opts;

  if (currentSlackUserId && player.slackId === currentSlackUserId) {
    return false;
  }

  if (currentClientId) {
    if (player.clientId === currentClientId) {
      return false;
    }

    const normalizedSlackId = resolveSlackUserId(currentClientId);
    if (normalizedSlackId && player.slackId === normalizedSlackId) {
      return false;
    }
  }

  return true;
}
