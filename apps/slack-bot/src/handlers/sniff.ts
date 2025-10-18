import { sniffNearestMonster, SniffProximity } from '../dm-client';
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

export const sniffHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const response = await sniffNearestMonster({
      slackId: toClientId(userId),
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
      await say({
        text: appendSettlementInfo(baseMessage, settlementFragment),
      });
      return;
    }

    const direction = data.direction ? ` to the ${data.direction}` : '';
    const distanceText = resolveDistanceLabel(
      data.distanceLabel,
      data.proximity,
    );
    const fallbackMessage = `You catch the scent of ${data.monsterName} ${distanceText}${direction}.`;
    const baseMessage = response.message ?? fallbackMessage;
    await say({
      text: appendSettlementInfo(baseMessage, settlementFragment),
    });
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
};

registerHandler(COMMANDS.SNIFF, sniffHandler);
