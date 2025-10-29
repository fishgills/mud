import { pickup } from '../dm-client';
import { COMMANDS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import { toClientId } from '../utils/clientId';
import {
  getUserFriendlyErrorMessage,
  mapErrCodeToFriendlyMessage,
} from './errorUtils';

export const pickupHandler = async ({ userId, say, text }: HandlerContext) => {
  const args = (text || '').trim().split(/\s+/).slice(1);
  const worldItemIdArg = args[0];
  if (!worldItemIdArg) {
    await say({ text: `Usage: ${COMMANDS.PICKUP} <worldItemId>` });
    return;
  }

  const worldItemId = Number(worldItemIdArg);
  if (!Number.isFinite(worldItemId) || worldItemId <= 0) {
    await say({ text: `Invalid worldItemId: ${worldItemIdArg}` });
    return;
  }

  try {
    const res = await pickup({ slackId: toClientId(userId), worldItemId });
    if (res && res.success) {
      await say({ text: res.message ?? 'You picked up an item.' });
    } else {
      const getCode = (v: unknown): string | undefined => {
        if (v && typeof v === 'object' && 'code' in v) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (v as any).code as string | undefined;
        }
        return undefined;
      };

      const friendly = mapErrCodeToFriendlyMessage(getCode(res));
      await say({
        text: friendly ?? res?.message ?? 'Failed to pick up item.',
      });
    }
  } catch (err) {
    const message = getUserFriendlyErrorMessage(err, 'Failed to pick up item');
    await say({ text: message });
  }
};

registerHandler(COMMANDS.PICKUP, pickupHandler);
