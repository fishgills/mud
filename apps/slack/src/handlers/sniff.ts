import { sniffNearestMonster, SniffProximity } from '../dm-client';
import type { KnownBlock, Block } from '@slack/types';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

export const sniffHandlerHelp = `Sniff out the nearest monster within range of your agility. Example: Send "${COMMANDS.SNIFF}".`;

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

    const data = response.data;

    if (!data || !data.monsterName) {
      const radius = data?.detectionRadius;
      const radiusLabel =
        typeof radius === 'number'
          ? `${radius} tile${radius === 1 ? '' : 's'}`
          : 'your range';
      const fallbackMessage = `You sniff the air but can't catch any monster scent within ${radiusLabel}.`;
      const text = response.message ?? fallbackMessage;
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
            text: `:nose: _No monster scent within ${radiusLabel}_.`,
          },
        },
      ];
      await say({ text, blocks });
      return;
    }

    const direction = data.direction ? ` to the ${data.direction}` : '';
    const distanceText = resolveDistanceLabel(
      data.distanceLabel,
      data.proximity,
    );
    const fallbackMessage = `You catch the scent of ${data.monsterName} ${distanceText}${direction}.`;
    const text = response.message ?? fallbackMessage;

    const monsterText = buildMonsterBlockText(data);
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
};

registerHandler(COMMANDS.SNIFF, sniffHandler);
