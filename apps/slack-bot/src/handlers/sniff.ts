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
    if (!data || !data.monsterName) {
      const radius = data?.detectionRadius;
      const radiusLabel =
        typeof radius === 'number'
          ? `${radius} tile${radius === 1 ? '' : 's'}`
          : 'your range';
      await say({
        text:
          response.message ??
          `You sniff the air but can't catch any monster scent within ${radiusLabel}.`,
      });
      return;
    }

    const direction = data.direction ? ` to the ${data.direction}` : '';
    const distanceText = resolveDistanceLabel(
      data.distanceLabel,
      data.proximity,
    );
    await say({
      text:
        response.message ??
        `You catch the scent of ${data.monsterName} ${distanceText}${direction}.`,
    });
  } catch (err) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to sniff for monsters',
    );
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.SNIFF, sniffHandler);
