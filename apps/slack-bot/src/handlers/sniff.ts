import { dmSdk } from '../clients/dm-sdk';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';
import { toClientId } from '../utils/clientId';

export const sniffHandlerHelp = `Sniff out the nearest monster within range of your agility. Example: Send "${COMMANDS.SNIFF}".`;

const formatDistance = (distance: number | null | undefined): string => {
  if (typeof distance !== 'number' || !Number.isFinite(distance)) {
    return 'some tiles';
  }
  const rounded = Math.round(distance * 10) / 10;
  const trimmed = rounded.toFixed(1).replace(/\.0$/, '');
  return `${trimmed} tiles`;
};

export const sniffHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const response = await dmSdk.SniffNearestMonster({
      slackId: toClientId(userId),
    });

    const payload = response.sniffNearestMonster;
    if (!payload.success) {
      await say({
        text: payload.message ?? 'Failed to sniff for monsters.',
      });
      return;
    }

    const data = payload.data;
    if (!data || !data.monsterName) {
      const radius = data?.detectionRadius;
      const radiusLabel =
        typeof radius === 'number'
          ? `${radius} tile${radius === 1 ? '' : 's'}`
          : 'your range';
      await say({
        text:
          payload.message ??
          `You sniff the air but can't catch any monster scent within ${radiusLabel}.`,
      });
      return;
    }

    const direction = data.direction ?? 'nearby';
    const distanceText = formatDistance(data.distance);
    await say({
      text:
        payload.message ??
        `You catch the scent of ${data.monsterName} about ${distanceText} ${direction}.`,
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
