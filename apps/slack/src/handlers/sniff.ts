import {
  sniffNearestMonster,
  SniffProximity,
  type SniffData,
} from '../dm-client';
import type { KnownBlock, Block } from '@slack/types';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

export const sniffHandlerHelp = `Sniff out the nearest monster (and any nearby players) within range of your agility. Example: Send "${COMMANDS.SNIFF}".`;

const proximityPhrases: Record<SniffProximity, string> = {
  immediate: 'right under your nose',
  close: 'very close',
  near: 'nearby',
  far: 'a ways off',
  distant: 'far off',
  unknown: 'somewhere nearby',
};

const resolveDistanceLabel = (
  label?: string | null,
  proximity?: SniffProximity,
): string => {
  const trimmed = label?.trim();
  if (trimmed) {
    return trimmed;
  }

  if (proximity && proximityPhrases[proximity]) {
    return proximityPhrases[proximity];
  }

  return proximityPhrases.unknown;
};

const arrowForDirection = (direction?: string): string => {
  switch ((direction || '').toLowerCase()) {
    case 'north':
      return ':arrow_up:';
    case 'south':
      return ':arrow_down:';
    case 'east':
      return ':arrow_right:';
    case 'west':
      return ':arrow_left:';
    case 'here':
      return ':round_pushpin:';
    default:
      return ':compass:';
  }
};

const buildMonsterBlockText = (data?: {
  monsterName?: string;
  distanceLabel?: string;
  proximity?: SniffProximity;
  direction?: string;
}): string | undefined => {
  if (!data || !data.monsterName) return undefined;
  const distanceText = resolveDistanceLabel(data.distanceLabel, data.proximity);
  const dir = data.direction?.trim();
  const arrow = arrowForDirection(dir);
  const dirText = dir && dir !== 'here' ? ` to the ${dir}` : '';
  // Example: :japanese_goblin: *Monster* • Goblin — _nearby_ to the north
  return `:japanese_goblin: *Monster* • ${data.monsterName} — _${distanceText}_${dirText ? `${dirText}` : ''} ${arrow}`.trim();
};

const buildPlayerBlockText = (data?: {
  playerName?: string;
  playerDistanceLabel?: string;
  playerProximity?: SniffProximity;
  playerDirection?: string;
}): string | undefined => {
  if (!data || !data.playerName) return undefined;
  const distanceText = resolveDistanceLabel(
    data.playerDistanceLabel,
    data.playerProximity,
  );
  const dir = data.playerDirection?.trim();
  const arrow = arrowForDirection(dir);
  const dirText = dir && dir !== 'here' ? ` to the ${dir}` : '';
  return `:bust_in_silhouette: *Player* • ${data.playerName} — _${distanceText}_${dirText ? `${dirText}` : ''} ${arrow}`.trim();
};

export const sniffHandler = async ({ userId, say, teamId }: HandlerContext) => {
  try {
    const response = await sniffNearestMonster({
      teamId,
      userId,
    });

    if (!response.success) {
      await say({
        text: response.message ?? 'Failed to sniff for monsters.',
      });
      return;
    }

    const data: Partial<SniffData> = response.data ?? {};

    const monsterRadius = data?.detectionRadius;
    const playerRadius = data?.playerDetectionRadius;
    const monsterRadiusLabel =
      typeof monsterRadius === 'number'
        ? `${monsterRadius} tile${monsterRadius === 1 ? '' : 's'}`
        : 'your range';
    const playerRadiusLabel =
      typeof playerRadius === 'number'
        ? `${playerRadius} tile${playerRadius === 1 ? '' : 's'}`
        : 'your extended range';

    const hasMonster = Boolean(data?.monsterName);
    const hasPlayer = Boolean(data?.playerName);

    if (!hasMonster && !hasPlayer) {
      const fallbackMessage =
        response.message ??
        `You sniff the air but can't catch any monster scent within ${monsterRadiusLabel} or any players within ${playerRadiusLabel}.`;
      const text = fallbackMessage;
      // Build a richer Block Kit layout
      const blocks: (KnownBlock | Block)[] = [
        {
          type: 'header' as const,
          text: { type: 'plain_text' as const, text: 'Sniff', emoji: true },
        },
        {
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `:nose: _No monster scent within ${monsterRadiusLabel} or players within ${playerRadiusLabel}_.`,
          },
        },
      ];
      await say({ text, blocks });
      return;
    }

    const monsterDirection = data.direction ? ` to the ${data.direction}` : '';
    const monsterDistanceText = resolveDistanceLabel(
      data.distanceLabel,
      data.proximity,
    );
    const playerDirection = data.playerDirection
      ? ` to the ${data.playerDirection}`
      : '';
    const playerDistanceText = resolveDistanceLabel(
      data.playerDistanceLabel,
      data.playerProximity,
    );
    const fallbackMessageParts = [
      data.monsterName
        ? `You catch the scent of ${data.monsterName} ${monsterDistanceText}${monsterDirection}.`
        : null,
      data.playerName
        ? `You smell ${data.playerName} ${playerDistanceText}${playerDirection}.`
        : null,
    ].filter(Boolean);
    const text = response.message ?? fallbackMessageParts.join(' ');

    const monsterText = buildMonsterBlockText(data);
    const playerText = buildPlayerBlockText(data);
    const blocks: (KnownBlock | Block)[] = [
      {
        type: 'header' as const,
        text: { type: 'plain_text' as const, text: 'Sniff', emoji: true },
      },
      ...(monsterText
        ? ([
            {
              type: 'section' as const,
              text: { type: 'mrkdwn' as const, text: monsterText },
            },
          ] as const)
        : []),
      ...(playerText
        ? ([
            {
              type: 'section' as const,
              text: { type: 'mrkdwn' as const, text: playerText },
            },
          ] as const)
        : []),
    ];

    await say({ text, blocks });
  } catch (err) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to sniff for monsters',
    );
    await say({ text: errorMessage });
  }
};

export const __private__ = {
  resolveDistanceLabel,
  arrowForDirection,
  buildMonsterBlockText,
  buildPlayerBlockText,
};

registerHandler(COMMANDS.SNIFF, sniffHandler);
