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
import { dmSdk } from '../gql-client';
import { toClientId } from '../utils/clientId';

export type NearbyPlayer = {
  id?: string | number;
  name: string;
  slackId?: string | null;
  isAlive?: boolean | null;
};

export type NearbyMonster = {
  id?: string | number;
  name: string;
  isAlive?: boolean | null;
  hp?: number | null;
};

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
export async function getOccupantsSummaryAt(
  x: number,
  y: number,
  currentSlackUserId?: string,
): Promise<string | null> {
  const clientId = currentSlackUserId
    ? toClientId(currentSlackUserId)
    : undefined;
  const res = await dmSdk.GetLocationEntities({ x, y });
  const players = (res.getPlayersAtLocation || []).filter((p) =>
    clientId ? p.slackId !== clientId : true,
  );
  const monsters = res.getMonstersAtLocation || [];
  return buildOccupantsSummary(players, monsters);
}

// Send occupants summary using arrays already available (e.g., from move mutation)
export async function sendOccupantsSummary(
  say: (message: { text: string }) => Promise<unknown>,
  players: NearbyPlayer[] | undefined,
  monsters: NearbyMonster[] | undefined,
  currentSlackUserId?: string,
): Promise<void> {
  const clientId = currentSlackUserId
    ? toClientId(currentSlackUserId)
    : undefined;
  const filteredPlayers = (players || []).filter((p) =>
    clientId ? p.slackId !== clientId : true,
  );
  const text = buildOccupantsSummary(filteredPlayers, monsters || []);
  if (text) {
    await say({ text });
  }
}
