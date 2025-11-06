import { sniffNearestMonster, SniffProximity } from '../dm-client';
import type { KnownBlock, Block } from '@slack/types';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';
import { toClientId } from '../utils/clientId';

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

const buildSettlementFragment = (data?: {
  nearestSettlementName?: string;
  nearestSettlementDirection?: string;
  nearestSettlementDistance?: number;
  nearestSettlementSize?: string;
  nearestSettlementType?: string;
  nearestSettlementPopulation?: number;
  nearestSettlementDescription?: string | null;
  nearestSettlementIsCurrent?: boolean;
  nearestSettlementDistanceLabel?: string;
  nearestSettlementProximity?: SniffProximity;
}): string => {
  if (!data) {
    return '';
  }
  const direction = data.nearestSettlementDirection?.trim();
  if (!direction) {
    return '';
  }

  const name = data.nearestSettlementName?.trim();
  if (direction === 'here') {
    if (name) {
      return ` You're right in ${name}.`;
    }
    return ' You are standing in a settlement.';
  }

  const nameSegment = name ? `${name} ` : '';
  const distanceText = resolveDistanceLabel(
    data.nearestSettlementDistanceLabel,
    data.nearestSettlementProximity,
  );
  const directionSegment = direction ? ` to the ${direction}` : '';

  return ` The nearest settlement is ${nameSegment}${distanceText}${directionSegment}.`;
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

const buildSettlementBlockText = (data?: {
  nearestSettlementName?: string;
  nearestSettlementDirection?: string;
  nearestSettlementDistanceLabel?: string;
  nearestSettlementProximity?: SniffProximity;
}): string | undefined => {
  if (!data) return undefined;
  const dir = data.nearestSettlementDirection?.trim();
  if (!dir) return undefined;

  const name = data.nearestSettlementName?.trim();
  if (dir === 'here') {
    if (name) return `:round_pushpin: *Settlement* • You're in *${name}*`;
    return `:round_pushpin: *Settlement* • You're in a settlement`;
  }

  const distanceText = resolveDistanceLabel(
    data.nearestSettlementDistanceLabel,
    data.nearestSettlementProximity,
  );
  const arrow = arrowForDirection(dir);
  const nameSegment = name ? `${name}` : 'a settlement';
  return `:house: *Settlement* • ${nameSegment} — _${distanceText}_ to the ${dir} ${arrow}`;
};

const settlementIndicators: RegExp[] = [
  /nearest settlement/i,
  /standing in a settlement/i,
  /you'?re right in/i,
];

const messageIncludesSettlementInfo = (message?: string | null): boolean => {
  if (!message) {
    return false;
  }

  return settlementIndicators.some((pattern) => pattern.test(message));
};

const appendSettlementInfo = (
  message: string,
  settlementFragment: string,
): string => {
  if (!settlementFragment || messageIncludesSettlementInfo(message)) {
    return message;
  }

  return `${message}${settlementFragment}`;
};

export const sniffHandler = async ({ userId, say, teamId }: HandlerContext) => {
  try {
    const response = await sniffNearestMonster({
      slackId: toClientId(userId, teamId || ''),
    });

    if (!response.success) {
      await say({
        text: response.message ?? 'Failed to sniff for monsters.',
      });
      return;
    }

    const data = response.data;
    const settlementFragment = buildSettlementFragment(data);

    if (!data || !data.monsterName) {
      const radius = data?.detectionRadius;
      const radiusLabel =
        typeof radius === 'number'
          ? `${radius} tile${radius === 1 ? '' : 's'}`
          : 'your range';
      const fallbackMessage = `You sniff the air but can't catch any monster scent within ${radiusLabel}.`;
      const baseMessage = response.message ?? fallbackMessage;
      const text = appendSettlementInfo(baseMessage, settlementFragment);
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
      const settlementText = buildSettlementBlockText(data);
      if (settlementText) {
        blocks.push({ type: 'divider' as const });
        blocks.push({
          type: 'section' as const,
          text: { type: 'mrkdwn' as const, text: settlementText },
        });
      }
      await say({ text, blocks });
      return;
    }

    const direction = data.direction ? ` to the ${data.direction}` : '';
    const distanceText = resolveDistanceLabel(
      data.distanceLabel,
      data.proximity,
    );
    const fallbackMessage = `You catch the scent of ${data.monsterName} ${distanceText}${direction}.`;
    const baseMessage = response.message ?? fallbackMessage;
    const text = appendSettlementInfo(baseMessage, settlementFragment);

    const monsterText = buildMonsterBlockText(data);
    const settlementText = buildSettlementBlockText(data);
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
      ...(settlementText
        ? ([
            { type: 'divider' as const },
            {
              type: 'section' as const,
              text: { type: 'mrkdwn' as const, text: settlementText },
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
  buildSettlementFragment,
  messageIncludesSettlementInfo,
  appendSettlementInfo,
  arrowForDirection,
  buildMonsterBlockText,
  buildSettlementBlockText,
};

registerHandler(COMMANDS.SNIFF, sniffHandler);
